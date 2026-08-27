// Pre-flight checks that are cheap to run and expensive to discover late.
//
//   pnpm audit:tools
//
// 1. Chrome enforces character budgets on tool metadata. Exceeding them fails
//    at registration time, which during a demo looks like the API is broken.
// 2. The detector is the input to every other part of the workflow, so a
//    regression in it is worth seeing as a diff rather than in the UI.

import { TOOL_SPECS, auditBudgets } from "../src/mcp/descriptions";
import { detectInPages } from "../src/core/detector";
import { SAMPLES } from "../src/core/samples";

let failed = false;

console.log("Tool metadata\n");
for (const spec of Object.values(TOOL_SPECS)) {
  const length = spec.description.length;
  const bar = length > 500 ? "OVER" : "ok  ";
  console.log(`  ${bar} ${String(length).padStart(3)}/500  ${spec.name}`);
}

const problems = auditBudgets();
if (problems.length > 0) {
  failed = true;
  console.log("\n  Budget violations:");
  for (const problem of problems) console.log("    " + problem);
}

console.log("\nDetector over the sample documents\n");
for (const sample of SAMPLES) {
  const findings = detectInPages(sample.pages);
  const byType = new Map<string, number>();
  for (const finding of findings) {
    byType.set(finding.type, (byType.get(finding.type) ?? 0) + 1);
  }
  const weak = findings.filter((finding) => finding.confidence <= 0.6).length;
  const breakdown = [...byType.entries()]
    .sort()
    .map(([type, count]) => `${type} ${count}`)
    .join(", ");
  console.log(`  ${sample.id}: ${findings.length} findings (${weak} low confidence)`);
  console.log(`    ${breakdown}`);

  if (findings.length === 0) {
    failed = true;
    console.log("    FAIL: a sample with no findings cannot demonstrate anything");
  }
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
