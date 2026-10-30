export type Category =
  | "identity"
  | "contact"
  | "government-id"
  | "financial"
  | "health"
  | "location"
  | "device-id"
  | "children";

export type Severity = "high" | "medium" | "low";

export interface PiiMatch {
  /** Stable key, e.g. "email". */
  element: string;
  /** Human label, e.g. "Email address". */
  label: string;
  category: Category;
  /** "medium" for names that are often not personal data (e.g. `name`). */
  confidence: "high" | "medium";
  /** True for age / date of birth: hints that children's data may be processed. */
  ageSignal?: boolean;
}

export interface Location {
  file: string;
  line: number;
}

export type CollectSource = "form" | "react-hook-form" | "zod";

export interface Collected extends Location {
  match: PiiMatch;
  field: string;
  source: CollectSource;
}

export interface Stored extends Location {
  match: PiiMatch;
  model: string;
  field: string;
}

export interface Shared extends Location {
  match: PiiMatch;
  processor: string;
  call: string;
}

export interface Logged extends Location {
  /** Null when a whole user-like object is logged. */
  match: PiiMatch | null;
  call: string;
  expression: string;
}

export interface ConsentCheckbox extends Location {
  field: string;
}

export interface Facts {
  collected: Collected[];
  stored: Stored[];
  shared: Shared[];
  logged: Logged[];
  preTicked: ConsentCheckbox[];
  /** Processors found in package.json dependencies. */
  installed: { processor: string; kind: string; pkg: string }[];
  /** Any code or schema that looks like it records consent. */
  consentRecord: Location | null;
  /** Any code that looks like a guardian / parental consent flow. */
  guardianFlow: Location | null;
  /** Lowercased model names that have a delete / erase call somewhere. */
  deletedModels: Set<string>;
  /** First line of each Prisma model, keyed by model name. */
  models: Map<string, Location>;
  filesScanned: number;
}

export interface Gap extends Location {
  rule: string;
  title: string;
  severity: Severity;
  message: string;
  fix: string;
}

export interface RegisterRow {
  element: string;
  label: string;
  category: Category;
  confidence: "high" | "medium";
  collectedAt: Location[];
  storedIn: (Location & { ref: string })[];
  sharedWith: string[];
  loggedAt: Location[];
  purpose: string;
  retention: string;
}

export interface ScanResult {
  root: string;
  generatedAt: string;
  filesScanned: number;
  register: RegisterRow[];
  thirdParties: { processor: string; kind: string; pkg: string }[];
  gaps: Gap[];
}

export interface SourceInput {
  /** Path relative to the scan root, with forward slashes. */
  path: string;
  text: string;
}
