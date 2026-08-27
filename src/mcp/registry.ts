// Assembling the tool surface for the current state.
//
// The split is deliberate: surface.ts decides *which* tools exist and is pure
// policy; this file decides *what they are* and is pure wiring. Neither one
// knows how registration works — that is useWebMCPTools — so the three concerns
// can be read and changed independently.

import type { ToolName } from "./descriptions";
import { activeToolNames } from "./surface";
import type { State } from "../state/store";

import { addRedactionRule } from "./tools/addRedactionRule";
import { applyRedactionPlan } from "./tools/applyRedactionPlan";
import { describeDocument } from "./tools/describeDocument";
import { exportRedactedDocument } from "./tools/exportRedactedDocument";
import { getAuditLog } from "./tools/getAuditLog";
import { getWorkflowState } from "./tools/getWorkflowState";
import { listFindings } from "./tools/listFindings";
import { openSampleDocument } from "./tools/openSampleDocument";
import { previewRedactionPlan } from "./tools/previewRedactionPlan";
import { redactSelection } from "./tools/redactSelection";
import { requestDisclosure } from "./tools/requestDisclosure";
import { scanForSensitiveData } from "./tools/scanForSensitiveData";
import { setFindingStatus } from "./tools/setFindingStatus";
import { verifyNoResidualText } from "./tools/verifyNoResidualText";

const FACTORIES: Record<ToolName, () => WebMCPTool> = {
  get_workflow_state: getWorkflowState,
  open_sample_document: openSampleDocument,
  describe_document: describeDocument,
  scan_for_sensitive_data: scanForSensitiveData,
  list_findings: listFindings,
  request_disclosure: requestDisclosure,
  add_redaction_rule: addRedactionRule,
  set_finding_status: setFindingStatus,
  preview_redaction_plan: previewRedactionPlan,
  apply_redaction_plan: applyRedactionPlan,
  verify_no_residual_text: verifyNoResidualText,
  export_redacted_document: exportRedactedDocument,
  get_audit_log: getAuditLog,
  redact_selection: redactSelection
};

/** Every tool that could ever exist, for the panel that shows what is dormant. */
export const ALL_TOOL_NAMES = Object.keys(FACTORIES) as ToolName[];

export function buildTools(state: State): WebMCPTool[] {
  return activeToolNames(state).map((name) => FACTORIES[name]());
}
