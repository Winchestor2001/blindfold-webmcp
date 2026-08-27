// Which tools exist right now.
//
// Blindfold's tool surface is contextual: a tool is registered only while it is
// applicable. This is not decoration. An agent choosing between fourteen tools
// on an empty page will guess; an agent offered two will not. And a tool that is
// absent cannot be called at the wrong time, which removes a whole class of
// error handling — apply_redaction_plan simply does not exist until there is a
// plan to apply.
//
// The rule is one function of state, kept here so that the registration
// lifecycle in useWebMCPTools stays mechanical and the policy stays readable.

import type { ToolName } from "./descriptions";
import { planCounts, stageOf, type State } from "../state/store";

/** Available in every state, so the agent is never facing an empty page. */
const ALWAYS: ToolName[] = ["get_workflow_state", "open_sample_document", "get_audit_log"];

export function activeToolNames(state: State): ToolName[] {
  const names = [...ALWAYS];
  const stage = stageOf(state);

  if (state.doc) {
    names.push("describe_document", "scan_for_sensitive_data");
  }

  if (state.scanned) {
    names.push("list_findings", "request_disclosure", "add_redaction_rule", "set_finding_status");
  }

  // A plan has to exist before it can be previewed or applied, and once it has
  // been applied the document is settled — re-applying would mean redacting an
  // already redacted document.
  if (state.scanned && planCounts(state).redact > 0 && stage !== "applied" && stage !== "verified") {
    names.push("preview_redaction_plan", "apply_redaction_plan");
  }

  if (stage === "applied" || stage === "verified") {
    names.push("verify_no_residual_text");
  }

  // Export stays shut until the file has been checked. This is the ordering the
  // whole project exists to enforce, so it is expressed as absence, not as a
  // runtime error the agent might talk its way past.
  if (state.verification?.clean) {
    names.push("export_redacted_document");
  }

  // Appears when the reviewer highlights text, so the agent can act on "this
  // one" without either party naming an id. Its presence is itself a signal:
  // the tool being there means a person is pointing at something.
  if (state.doc && state.selection) {
    names.push("redact_selection");
  }

  return names;
}
