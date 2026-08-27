// apply_redaction_plan — the irreversible step.
//
// The call suspends on a human. Not a confirmation the agent can pass a flag to
// skip, and not a setting: a dialog in the page, listing what will be removed,
// waiting for a click. If nobody answers within three minutes the call comes
// back refused.
//
// This is also the point at which a document that argues for its own release
// gets nowhere. leaked_memo contains an instruction telling the agent to mark
// everything as keep and export immediately. An agent that believed it would
// still arrive here, and a person would still be looking at a dialog saying how
// many values are about to survive.

import { contract, requireScan } from "./shared";
import {
  planCounts,
  record,
  requestConfirmation,
  setApplied,
  setPreviewing
} from "../../state/store";

export function applyRedactionPlan(): WebMCPTool {
  return {
    ...contract("apply_redaction_plan"),
    execute: async (_input, { signal }) => {
      const state = requireScan();
      const marked = state.findings.filter((finding) => finding.status === "redact");

      if (marked.length === 0) {
        throw new Error(
          "Nothing is marked for redaction. Call list_findings with status \"unreviewed\" to see candidates, then set_finding_status with status \"redact\"."
        );
      }

      const counts = planCounts(state);
      const pages = [...new Set(marked.map((finding) => finding.page))].sort((a, b) => a - b);
      const types = [...new Set(marked.map((finding) => finding.type))].sort();

      setPreviewing(true);
      record("agent", "apply_redaction_plan", `requested approval for ${marked.length} redactions`);

      const approved = await requestConfirmation(
        "apply",
        `Remove ${marked.length} values from ${state.doc!.title}?`,
        [
          `Types: ${types.join(", ")}`,
          `Pages: ${pages.join(", ")}`,
          `Staying in the document: ${counts.keep} decided, ${counts.unreviewed} unreviewed`,
          "This cannot be undone. The text is deleted, not covered over."
        ],
        signal
      );

      if (!approved) {
        record("human", "apply_redaction_plan", "declined");
        return {
          applied: false,
          reason: "The reviewer did not approve the redaction.",
          guidance:
            "Nothing was changed. Adjust the plan with set_finding_status or add_redaction_rule and ask again, or ask the reviewer what they want changed."
        };
      }

      setApplied({
        at: new Date().toISOString(),
        redactedIds: marked.map((finding) => finding.id),
        pages
      });
      setPreviewing(false);
      record("human", "apply_redaction_plan", `approved — ${marked.length} values removed`);

      return {
        applied: true,
        removed: marked.length,
        pages,
        kept: counts.keep + counts.unreviewed,
        note: "Call verify_no_residual_text next. Export stays unavailable until that reports clean."
      };
    }
  };
}
