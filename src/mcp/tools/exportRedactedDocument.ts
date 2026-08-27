// export_redacted_document — handing the file over.
//
// Two gates stand in front of this. The tool is not registered at all until
// verify_no_residual_text has reported clean, so an agent cannot reach it by
// arguing; and the download itself waits for a person to approve it.
//
// The exported PDF carries an audit page recording who decided what, by finding
// id and type only. A redacted document that cannot say how it was redacted is
// hard to defend later, and the values must not be in the audit trail either.

import { contract, requireScan } from "./shared";
import { downloadBytes } from "../../core/download";
import { buildRedactedPdf, sha256 } from "../../core/redact";
import { getState, record, requestConfirmation, setExported } from "../../state/store";

export function exportRedactedDocument(): WebMCPTool {
  return {
    ...contract("export_redacted_document"),
    execute: async (_input, { signal }) => {
      const state = requireScan();
      if (!state.verification?.clean) {
        throw new Error(
          "The export has not been verified. Call verify_no_residual_text and get a clean result first."
        );
      }

      const redacted = state.findings.filter((finding) => finding.status === "redact");
      const filename = `${state.doc!.id}-redacted.pdf`;

      record("agent", "export_redacted_document", `requested approval to download ${filename}`);
      const approved = await requestConfirmation(
        "export",
        `Download ${filename}?`,
        [
          `${redacted.length} values were removed and verified absent from the file.`,
          `${state.findings.length - redacted.length} values remain in the document.`,
          "The file includes an audit page listing decisions by finding id and type."
        ],
        signal
      );

      if (!approved) {
        record("human", "export_redacted_document", "declined");
        return {
          exported: false,
          reason: "The reviewer did not approve the download.",
          guidance: "The file was not written. Ask what they want to change, or leave it."
        };
      }

      const bytes = await buildRedactedPdf({ doc: state.doc!, redacted, audit: getState().audit });
      const digest = await sha256(bytes);
      downloadBytes(bytes, filename, "application/pdf");

      setExported({
        at: new Date().toISOString(),
        filename,
        bytes: bytes.length,
        sha256: digest
      });
      record("human", "export_redacted_document", `approved — ${filename}, sha256 ${digest.slice(0, 16)}`);

      return {
        exported: true,
        filename,
        bytes: bytes.length,
        sha256: digest,
        note: "The digest identifies this exact file, so a later question about it can be answered without opening it."
      };
    }
  };
}
