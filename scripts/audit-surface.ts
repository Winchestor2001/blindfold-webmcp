// Drives the whole tool surface the way an agent would.
//
//   pnpm audit:surface
//
// Runs the end-to-end scenario with no browser and no agent, answering the human
// gates from the script. It checks three things that are easy to get wrong and
// expensive to discover late:
//
//   1. the registered tool set actually changes with state — the claim that the
//      surface is contextual, tested rather than asserted;
//   2. every tool result fits Chrome's 1.5K output budget, measured on real
//      data rather than estimated;
//   3. the gates hold — apply and export do not proceed without an answer;
//   4. no preview leaks a value, whole or in part, that the human has not
//      released — the privacy invariant of CLAUDE.md Rule 6, checked against
//      every finding on every page rather than spot-checked.

import { buildTools } from "../src/mcp/registry";
import { OUTPUT_BUDGET, measure } from "../src/mcp/fit";
import { previewFor } from "../src/core/mask";
import {
  answerConfirmation,
  answerDisclosure,
  getState,
  subscribe
} from "../src/state/store";

// The export tool hands bytes to the browser. Node has neither an object URL
// nor a DOM, so a stub stands in and records that the download was reached.
let downloaded: string | null = null;
const anyGlobal = globalThis as Record<string, unknown>;
anyGlobal.URL = Object.assign(anyGlobal.URL as object, {
  createObjectURL: () => "blob:stub",
  revokeObjectURL: () => {}
});
anyGlobal.document = {
  createElement: () => ({
    set download(name: string) {
      downloaded = name;
    },
    href: "",
    click: () => {},
    remove: () => {}
  }),
  body: { appendChild: () => {} }
};

// A stand-in reviewer. Grants the first disclosure, refuses the second, and
// approves both irreversible steps — so the transcript below shows a refusal
// being handled as well as a grant.
let disclosuresSeen = 0;
subscribe(() => {
  const state = getState();
  for (const request of state.disclosures) {
    disclosuresSeen += 1;
    const grant = disclosuresSeen === 1;
    queueMicrotask(() =>
      answerDisclosure(
        request.id,
        grant,
        grant ? undefined : "Not needed for this decision."
      )
    );
  }
  for (const request of state.confirms) {
    queueMicrotask(() => answerConfirmation(request.id, true));
  }
});

let failed = false;

function surface(): string[] {
  return buildTools(getState()).map((tool) => tool.name);
}

async function call(name: string, input: Record<string, unknown> = {}): Promise<unknown> {
  const tool = buildTools(getState()).find((candidate) => candidate.name === name);
  if (!tool) {
    failed = true;
    console.log(`  ${name}: NOT REGISTERED — expected it to be available here`);
    console.log(`     available: ${surface().join(", ")}`);
    return null;
  }

  const controller = new AbortController();
  const result = await tool.execute(input, { signal: controller.signal });
  const size = measure(result);
  const flag = size > OUTPUT_BUDGET ? `OVER BUDGET (${size} > ${OUTPUT_BUDGET})` : `${size}`;
  if (size > OUTPUT_BUDGET) failed = true;
  console.log(`  ${name}  -> ${flag} chars`);
  return result;
}

function expectSurface(label: string, present: string[], absent: string[]): void {
  const names = new Set(surface());
  const missing = present.filter((name) => !names.has(name));
  const leaked = absent.filter((name) => names.has(name));
  if (missing.length > 0 || leaked.length > 0) {
    failed = true;
    console.log(`  SURFACE FAIL at ${label}`);
    if (missing.length > 0) console.log(`     missing: ${missing.join(", ")}`);
    if (leaked.length > 0) console.log(`     should not be there: ${leaked.join(", ")}`);
  } else {
    console.log(`  surface at ${label}: ${surface().length} tools, as expected`);
  }
}

console.log("no document");
expectSurface(
  "no document",
  ["get_workflow_state", "open_sample_document", "get_audit_log"],
  ["scan_for_sensitive_data", "list_findings", "apply_redaction_plan", "export_redacted_document"]
);
await call("get_workflow_state");

console.log("\nopen and describe");
await call("open_sample_document", { document: "leaked_memo" });
expectSurface("document open", ["describe_document", "scan_for_sensitive_data"], ["list_findings"]);
await call("describe_document");

console.log("\nscan");
await call("scan_for_sensitive_data");
expectSurface(
  "scanned",
  ["list_findings", "request_disclosure", "add_redaction_rule"],
  ["apply_redaction_plan", "verify_no_residual_text", "export_redacted_document"]
);
await call("list_findings", { limit: 40 });
await call("list_findings", { types: ["PERSON"], status: "unreviewed" });

console.log("\nprivacy invariant");
{
  // Every finding gets a preview, and every preview is searched for every
  // value in the document. A window of context cuts through neighbouring
  // values as often as not, so the interesting failures are partial: the tail
  // of an account number, the first half of a name. Fragments of six
  // characters and up are treated as a leak.
  const state = getState();
  const pages = new Map(state.doc!.pages.map((page) => [page.number, page.text]));
  const fragments: Array<{ text: string; from: string }> = [];
  for (const finding of state.findings) {
    const value = finding.value.trim();
    if (value.length < 6) continue;
    fragments.push({ text: value, from: `${finding.id} whole` });
    fragments.push({ text: value.slice(0, 6), from: `${finding.id} head` });
    fragments.push({ text: value.slice(-6), from: `${finding.id} tail` });
  }

  let leaks = 0;
  let previews = 0;
  for (const strict of [false, true]) {
    for (const finding of state.findings) {
      const onPage = state.findings.filter((other) => other.page === finding.page);
      const preview = previewFor(pages.get(finding.page)!, finding, onPage, strict);
      previews += 1;
      for (const fragment of fragments) {
        if (!preview.includes(fragment.text)) continue;
        leaks += 1;
        failed = true;
        if (leaks <= 5) {
          console.log(`  LEAK in preview of ${finding.id}: ${fragment.from} — ${preview}`);
        }
      }
    }
  }
  if (leaks === 0) {
    console.log(
      `  ${previews} previews checked against ${fragments.length} fragments: nothing leaked`
    );
  } else {
    console.log(`  ${leaks} leaks across ${previews} previews`);
  }
}

console.log("\ndisclosure gate");
const first = getState().findings.find((finding) => finding.type === "ORG");
const granted = (await call("request_disclosure", {
  finding_id: first?.id,
  reason: "Telling a company apart from an individual changes whether it is redacted."
})) as { disclosed: boolean } | null;
const refused = (await call("request_disclosure", {
  finding_id: getState().findings[0]?.id,
  reason: "Curiosity."
})) as { disclosed: boolean } | null;
if (granted?.disclosed !== true || refused?.disclosed !== false) {
  failed = true;
  console.log("  GATE FAIL: expected the first request granted and the second refused");
}

console.log("\nplan");
await call("add_redaction_rule", {
  types: ["PERSON", "EMAIL", "PHONE", "ADDRESS", "ACCOUNT", "NATIONAL_ID", "IP"],
  action: "redact"
});
await call("add_redaction_rule", { types: ["MONEY", "DATE"], action: "keep" });
expectSurface("plan exists", ["preview_redaction_plan", "apply_redaction_plan"], ["export_redacted_document"]);
await call("preview_redaction_plan");

console.log("\napply and verify");
await call("apply_redaction_plan");
expectSurface("applied", ["verify_no_residual_text"], ["apply_redaction_plan", "export_redacted_document"]);
const verified = (await call("verify_no_residual_text")) as { clean: boolean } | null;
if (verified?.clean !== true) {
  failed = true;
  console.log("  VERIFY FAIL: expected a clean result");
}

console.log("\nexport");
expectSurface("verified", ["export_redacted_document"], ["apply_redaction_plan"]);
await call("export_redacted_document");
if (downloaded === null) {
  failed = true;
  console.log("  EXPORT FAIL: the download was never reached");
} else {
  console.log(`  downloaded: ${downloaded}`);
}

// A proof is about a set of values. Once the plan grows past what was proved,
// the badge must stop claiming it and export must shut again — otherwise the
// header says "verified" over a document that has since changed, which is the
// one failure this project cannot afford.
console.log("\na change to the plan retires the proof");
const kept = getState().findings.find((finding) => finding.status === "keep");
if (!kept) {
  failed = true;
  console.log("  STALE FAIL: no kept finding to move into the plan");
} else {
  await call("set_finding_status", { finding_ids: [kept.id], status: "redact" });
  if (getState().verification !== null) {
    failed = true;
    console.log("  STALE FAIL: the verification survived a change to the plan");
  } else {
    console.log("  the verification was discarded, as expected");
  }
  expectSurface("plan changed after verifying", ["verify_no_residual_text"], ["export_redacted_document"]);

  const reverified = (await call("verify_no_residual_text")) as { clean: boolean } | null;
  if (reverified?.clean !== true) {
    failed = true;
    console.log("  STALE FAIL: re-verification did not come back clean");
  }
  expectSurface("re-verified", ["export_redacted_document"], ["apply_redaction_plan"]);

  // Marking an id that is already in the plan changes nothing, so a valid proof
  // has to survive it. Otherwise every redundant call would cost a re-verify.
  await call("set_finding_status", { finding_ids: [kept.id], status: "redact" });
  if (getState().verification === null) {
    failed = true;
    console.log("  STALE FAIL: re-marking an id already in the plan discarded a valid proof");
  } else {
    console.log("  a no-op status write left the proof standing");
  }
}

console.log("\naudit");
await call("get_audit_log");

console.log(`\n${failed ? "FAILED" : "Surface audit passed."}`);
process.exit(failed ? 1 : 0);
