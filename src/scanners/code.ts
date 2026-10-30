import { Node, Project, SourceFile, ts, type CallExpression } from "ts-morph";
import { classify, classifyAutocomplete, classifyInputType, isPersonObject } from "../pii.js";
import { processorForCall } from "../processors.js";
import type { Facts, PiiMatch, SourceInput } from "../types.js";

const LOG_CALL = /^(console\.(log|info|warn|error|debug|trace)|(logger|log|pino|winston)\.(log|info|warn|error|debug|trace|fatal))$/;
const CONSENT_FIELD = /consent|agree|accept|terms|privacy|marketing|newsletter|optin|opt-in/i;
const CONSENT_SYMBOL = /consent/i;
const GUARDIAN_SYMBOL = /guardian|parental|parentconsent|verifiableconsent/i;
const FORM_TAG = /^(input|select|textarea)$|(Input|Field|Select|TextArea|Textarea|Checkbox)$/;
const DELETE_CALL = /\.(\w+)\.(delete|deleteMany)$/;

/** Parse JS/TS/JSX files and add what they reveal to `facts`. */
export function scanCode(files: SourceInput[], facts: Facts): void {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve },
  });
  for (const f of files) {
    const sf = project.createSourceFile(f.path, f.text, { overwrite: true });
    scanFile(sf, f.path, facts);
  }
}

function scanFile(sf: SourceFile, file: string, facts: Facts): void {
  sf.forEachDescendant((node) => {
    if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
      scanJsxElement(node, file, facts);
    } else if (Node.isCallExpression(node)) {
      scanCall(node, file, facts);
    } else if (Node.isIdentifier(node)) {
      const text = node.getText();
      if (!facts.consentRecord && CONSENT_SYMBOL.test(text)) facts.consentRecord = { file, line: node.getStartLineNumber() };
      if (!facts.guardianFlow && GUARDIAN_SYMBOL.test(text)) facts.guardianFlow = { file, line: node.getStartLineNumber() };
    }
  });
}

type JsxTag = Parameters<typeof attrMap>[0];

function attrMap(el: import("ts-morph").JsxOpeningElement | import("ts-morph").JsxSelfClosingElement) {
  const attrs = new Map<string, string | true>();
  for (const a of el.getAttributes()) {
    if (!Node.isJsxAttribute(a)) continue;
    const name = a.getNameNode().getText();
    const init = a.getInitializer();
    if (!init) attrs.set(name, true);
    else if (Node.isStringLiteral(init)) attrs.set(name, init.getLiteralText());
    else if (Node.isJsxExpression(init)) {
      const expr = init.getExpression();
      if (expr && (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr))) attrs.set(name, expr.getLiteralText());
      else attrs.set(name, expr?.getText() ?? "");
    }
  }
  return attrs;
}

function scanJsxElement(el: JsxTag, file: string, facts: Facts): void {
  const tag = el.getTagNameNode().getText();
  if (!FORM_TAG.test(tag)) return;
  const attrs = attrMap(el);
  const str = (k: string) => {
    const v = attrs.get(k);
    return typeof v === "string" ? v : "";
  };
  const field = str("name") || str("id");
  const line = el.getStartLineNumber();
  const type = str("type").toLowerCase();

  if (type === "checkbox" || /Checkbox$/.test(tag)) {
    const checked = attrs.get("defaultChecked") ?? attrs.get("checked");
    const label = field || str("aria-label");
    if ((checked === true || checked === "true") && CONSENT_FIELD.test(label)) {
      facts.preTicked.push({ file, line, field: label });
    }
    return;
  }

  const match =
    (field ? classify(field) : null) ??
    classifyAutocomplete(str("autoComplete") || str("autocomplete")) ??
    classifyInputType(type);
  if (match) facts.collected.push({ file, line, field: field || type, source: "form", match });
}

function scanCall(call: CallExpression, file: string, facts: Facts): void {
  const callee = call.getExpression().getText().replace(/\s+/g, "");
  const line = call.getStartLineNumber();
  const args = call.getArguments();

  // react-hook-form: register("email")
  if (/(^|\.)register$/.test(callee)) {
    const first = args[0];
    if (first && Node.isStringLiteral(first)) {
      const match = classify(first.getLiteralText());
      if (match) facts.collected.push({ file, line, field: first.getLiteralText(), source: "react-hook-form", match });
    }
    return;
  }

  // zod: z.object({ ... })
  if (/^z\.object$/.test(callee)) {
    const obj = args[0];
    if (obj && Node.isObjectLiteralExpression(obj)) {
      for (const prop of obj.getProperties()) {
        if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) continue;
        const key = prop.getName().replace(/^["']|["']$/g, "");
        const init = Node.isPropertyAssignment(prop) ? prop.getInitializer()?.getText() ?? "" : "";
        const match = classify(key) ?? (/\.email\(/.test(init) ? classify("email") : null);
        if (match) facts.collected.push({ file, line: prop.getStartLineNumber(), field: key, source: "zod", match });
      }
    }
    return;
  }

  // prisma.user.delete(...) and friends
  const del = DELETE_CALL.exec(callee);
  if (del?.[1]) facts.deletedModels.add(del[1].toLowerCase());

  if (LOG_CALL.test(callee)) {
    for (const arg of args) {
      for (const hit of piiInExpression(arg)) {
        facts.logged.push({ file, line, call: callee, expression: hit.text, match: hit.match });
      }
    }
    return;
  }

  const processor = processorForCall(callee);
  if (processor) {
    const seen = new Set<string>();
    for (const arg of args) {
      for (const hit of piiInExpression(arg)) {
        if (!hit.match || seen.has(hit.match.element)) continue;
        seen.add(hit.match.element);
        facts.shared.push({ file, line, processor: processor.name, call: callee, match: hit.match });
      }
    }
  }
}

interface Hit {
  text: string;
  match: PiiMatch | null;
}

/**
 * Personal data names inside an argument: object keys, identifiers and
 * property names (`user.email`). A bare person object (`user`) is a hit
 * with `match: null`. Only high-confidence matches count here, so names
 * like `name` or `location` in everyday code do not flood the report.
 */
function piiInExpression(expr: Node): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const add = (text: string, match: PiiMatch | null) => {
    const key = match?.element ?? `obj:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ text, match });
  };
  const visit = (node: Node) => {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      // only object keys and property names, not free text
      const parent = node.getParent();
      if (parent && Node.isPropertyAssignment(parent) && parent.getNameNode() === node) check(node.getLiteralText(), node);
      return;
    }
    if (Node.isIdentifier(node)) check(node.getText(), node);
  };
  const check = (name: string, node: Node) => {
    const match = classify(name);
    if (match && match.confidence === "high") {
      add(topExpression(node).getText(), match);
      return;
    }
    // whole person object passed in, e.g. console.log(user)
    const parent = node.getParent();
    const inAccess = parent && Node.isPropertyAccessExpression(parent);
    const isKey = parent && Node.isPropertyAssignment(parent) && parent.getNameNode() === node;
    if (!inAccess && !isKey && isPersonObject(name)) add(name, null);
  };
  visit(expr);
  expr.forEachDescendant(visit);
  return hits;
}

/** For `user.profile.email`, return the whole access chain. */
function topExpression(node: Node): Node {
  let cur = node;
  let parent = cur.getParent();
  while (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === cur) {
    cur = parent;
    parent = cur.getParent();
  }
  if (parent && Node.isPropertyAssignment(parent)) return parent;
  return cur;
}
