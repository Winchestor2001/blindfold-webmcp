// Proves the central claim of the project against a real file.
//
//   pnpm audit:export
//
// Builds an export with a realistic redaction policy, then checks three things:
//
//   1. the search can actually read the bytes (otherwise a clean result is
//      meaningless, which is the exact mistake this project is about);
//   2. no redacted value survives anywhere in the file;
//   3. a kept value does survive, so the document is still a document.
//
// Then it runs the same check against a deliberately unredacted build of the
// same document and requires it to FAIL. A test that cannot fail is not a test,
// and "no residual text found" is a claim that has to be earned.

import { writeFileSync } from "node:fs";

import { detectInPages } from "../src/core/detector";
import { buildRedactedPdf, findResidual, sha256 } from "../src/core/redact";
import { SAMPLES } from "../src/core/samples";
import type { AuditEntry } from "../src/core/types";

const REDACT_TYPES = new Set(["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "NATIONAL_ID", "IP"]);

const audit: AuditEntry[] = [
  { at: new Date().toISOString(), actor: "human", action: "open_document", detail: "sample" },
  { at: new Date().toISOString(), actor: "agent", action: "add_redaction_rule", detail: "identifying types" }
];

let failed = false;

for (const sample of SAMPLES) {
  const doc = { ...sample, source: "sample" as const };
  const findings = detectInPages(doc.pages).map((finding) => ({
    ...finding,
    status: REDACT_TYPES.has(finding.type) ? ("redact" as const) : ("keep" as const)
  }));

  const redacted = findings.filter((finding) => finding.status === "redact");
  const kept = findings.filter((finding) => finding.status === "keep");
  const control = kept.find((finding) => finding.value.trim().length >= 6)?.value.trim() ?? null;

  const bytes = await buildRedactedPdf({ doc, redacted, audit });
  const report = await findResidual(bytes, redacted.map((finding) => finding.value), control);
  const digest = await sha256(bytes);

  const out = `/tmp/blindfold-${sample.id}.pdf`;
  writeFileSync(out, bytes);

  console.log(`${sample.id}`);
  console.log(`  ${(bytes.length / 1024).toFixed(1)} KB, sha256 ${digest.slice(0, 16)}…  -> ${out}`);
  console.log(`  redacted ${redacted.length}, kept ${kept.length}`);
  console.log(`  searchable: ${report.searchable}   control: ${JSON.stringify(control)}`);
  console.log(`  residual:   ${report.residual.length === 0 ? "none" : report.residual.join(", ")}`);

  if (!report.searchable) {
    failed = true;
    console.log("  FAIL: the bytes are not searchable, so a clean result would prove nothing");
  }
  if (report.residual.length > 0) {
    failed = true;
    console.log("  FAIL: redacted text survived into the exported file");
  }

  // Negative control: build the same document with nothing removed. The check
  // must now find what it just certified as absent.
  const unredacted = await buildRedactedPdf({ doc, redacted: [], audit });
  const negative = await findResidual(unredacted, redacted.map((finding) => finding.value), control);
  const caught = negative.residual.length;
  console.log(`  negative control: ${caught}/${redacted.length} values found when nothing is removed`);
  if (caught < redacted.length) {
    failed = true;
    console.log("  FAIL: the check missed values that are plainly in the file, so it cannot be trusted");
  }
  console.log();
}

console.log(failed ? "FAILED" : "Export verification passed.");
process.exit(failed ? 1 : 0);
