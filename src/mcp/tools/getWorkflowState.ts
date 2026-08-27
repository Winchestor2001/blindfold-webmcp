// get_workflow_state — where the workflow stands and what can be called now.
//
// This tool exists because the surface is contextual. An agent that cannot see
// a tool has no way to distinguish "not applicable yet" from "broken", and will
// either give up or invent a workaround. One call resolves that.

import { contract } from "./shared";
import { activeToolNames } from "../surface";
import { getState, planCounts, stageOf } from "../../state/store";

/** What to do next, in the words of the tool that does it. */
const SUGGESTION: Record<string, string> = {
  no_document: "Call open_sample_document to open a document.",
  document_open: "Call describe_document to orient yourself, or scan_for_sensitive_data to find values.",
  scanned: "Call list_findings to see what was found, then add_redaction_rule or set_finding_status to decide.",
  applied: "Call verify_no_residual_text to prove nothing survived.",
  verified: "Call export_redacted_document to hand over the file."
};

export function getWorkflowState(): WebMCPTool {
  return {
    ...contract("get_workflow_state"),
    execute: async () => {
      const state = getState();
      const stage = stageOf(state);
      return {
        stage,
        document: state.doc
          ? { title: state.doc.title, kind: state.doc.kind, pages: state.doc.pages.length }
          : null,
        scanned: state.scanned,
        plan: planCounts(state),
        rules: state.rules.length,
        applied: state.applied !== null,
        verified: state.verification?.clean === true,
        exported: state.exported !== null,
        reviewer_has_text_selected: state.selection !== null,
        tools_available_now: activeToolNames(state),
        suggested_next: SUGGESTION[stage]
      };
    }
  };
}
