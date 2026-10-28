# Project instructions: DPDP Guard

Paste this into the Claude project's instructions.

**Summary:** A TypeScript CLI + GitHub Action that scans a Next.js/Node codebase, finds where personal data is collected, stored, logged and shared, and writes the data register and gap report that India's DPDP Act 2023 and DPDP Rules 2025 expect. Built by me (senior frontend dev, React/Next.js/TS) as a portfolio piece and possible product.

**Why now:** Consent Manager rules start 14 Nov 2026. Consent, security, rights and breach duties start 14 May 2027. Lawyers write policies; nobody maps the code.

**Goal:** A working MVP I can run on a real Next.js repo and demo in interviews. Plan: docs/MVP-PLAN.md. Research: docs/RESEARCH.md.

**Not legal advice:** the tool flags and maps. It never says "you are compliant".

## Stack
- Node 22, ESM, TypeScript strict, published as `npx dpdp-guard scan`
- ts-morph for TS/TSX/JS parsing, @mrleebo/prisma-ast for Prisma, commander for the CLI
- vitest with small fixture apps in fixtures/
- Optional `--ai` step: @anthropic-ai/sdk, model `claude-opus-5-5`, structured JSON output

## What it scans
1. JSX forms: `<input name type autoComplete>`, react-hook-form `register("email")`
2. Validation schemas: Zod object keys and `.email()`
3. DB schemas: Prisma models (Drizzle later)
4. Sharing: analytics/error/payment SDKs (GA, Mixpanel, PostHog, Meta pixel, Sentry, Razorpay ...) receiving PII
5. Risky spots: PII in logs, pre-ticked consent, no consent record, no erasure route, children's data (age/DOB)

Categories: identity, contact, government ID (Aadhaar, PAN, passport, voter ID), financial, health, location, device/online identifier, children's data.

## Output
- `dpdp-register.md` + `dpdp-register.json`: data element, category, where collected, where stored, shared with, purpose (TODO), file:line
- `dpdp-gaps.md`: rule, severity, file:line, suggested fix
- `--fail-on high` exit code for CI

## Working style
Reply in short, simple English. Work in PRs on github.com/rahulcs754/dpdp-guard. Keep docs/ and CLAUDE.md up to date.
