// verify_no_residual_text — proving the claim instead of asserting it.
//
// Redaction fails publicly and repeatedly in one particular way: a black box is
// drawn over text, the text is still in the file, and anyone can select it. So
// this tool does not inspect the screen. It builds the exact bytes that export
// would hand over, decodes the content streams the way a PDF reader does, and
// searches them for every value that was supposed to be gone.
//
// It also checks a value the reviewer chose to keep. If that cannot be found
// either, the file was not readable and a clean result would prove nothing —
// which is the failure this whole tool exists to rule out. See
// src/core/redact.ts, and scripts/verify-export.ts for the same check run
// against a deliberately unredacted build.

import { contract, requireScan } from "./shared";
import { buildRedactedPdf, findResidual } from "../../core/redact";
import { getState, record, setVerification } from "../../state/store";

export function verifyNoResidualText(): WebMCPTool {
  return {
    ...contract("verify_no_residual_text"),
    execute: async () => {
      const state = requireScan();
      if (!state.applied) {
        throw new Error(
          "The plan has not been applied yet, so there is nothing to verify. Call apply_redaction_plan first."
        );
      }

      const redacted = state.findings.filter((finding) => finding.status === "redact");
      const control =
        state.findings
          .filter((finding) => finding.status !== "redact")
          .find((finding) => finding.value.trim().length >= 6)?.value.trim() ?? null;

      const bytes = await buildRedactedPdf({ doc: state.doc!, redacted, audit: getState().audit });
      const report = await findResidual(
        bytes,
        redacted.map((finding) => finding.value),
        control
      );

      if (!report.searchable) {
        setVerification({
          at: new Date().toISOString(),
          clean: false,
          checked: report.checked,
          residual: []
        });
        record("agent", "verify_no_residual_text", "inconclusive — file not readable as text");
        return {
          clean: false,
          conclusive: false,
          checked: report.checked,
          reason:
            "The check could not read text out of the generated file, so a clean result would prove nothing. Export stays blocked.",
          guidance: "Report this to the reviewer rather than exporting. This is a defect, not a pass."
        };
      }

      // Map surviving values back to ids so the reviewer is told which findings
      // leaked, without the tool result repeating the values themselves.
      const leaked = new Set(report.residual);
      const residualIds = redacted
        .filter((finding) => leaked.has(finding.value.trim()))
        .map((finding) => finding.id);

      const clean = report.residual.length === 0;
      setVerification({
        at: new Date().toISOString(),
        clean,
        checked: report.checked,
        residual: residualIds
      });
      record(
        "agent",
        "verify_no_residual_text",
        clean ? `clean — ${report.checked} values checked` : `${residualIds.length} values survived`
      );

      return {
        clean,
        conclusive: true,
        checked: report.checked,
        method: "searched the decoded content streams of the export bytes, not the rendered page",
        residual_finding_ids: residualIds,
        note: clean
          ? "Call export_redacted_document to hand over the file."
          : "These findings survived into the file. Export stays blocked. Report this to the reviewer."
      };
    }
  };
}
