// scan_for_sensitive_data — run the local detector and record the findings.
//
// Everything here happens in this page. There is no request, no upload, no
// model call: the detector is regular expressions, checksums and a name
// dictionary in src/core/detector.ts. That is the reason this application is a
// WebMCP page and not an MCP server — the document never leaves the device, and
// a server-side tool could not make that promise.

import { contract, requireDocument } from "./shared";
import { scan } from "../../state/store";

export function scanForSensitiveData(): WebMCPTool {
  return {
    ...contract("scan_for_sensitive_data"),
    execute: async () => {
      const doc = requireDocument();
      const findings = scan("agent");

      const counts = new Map<string, number>();
      for (const finding of findings) {
        counts.set(finding.type, (counts.get(finding.type) ?? 0) + 1);
      }

      const uncertain = findings.filter((finding) => finding.confidence <= 0.6);

      return {
        scanned_pages: doc.pages.length,
        found: findings.length,
        by_type: Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])),
        low_confidence: uncertain.length,
        low_confidence_ids: uncertain.slice(0, 12).map((finding) => finding.id),
        detection: "local — regular expressions and checksums, in this page, on this device",
        note: "No values are returned. Call list_findings to get ids and masked previews."
      };
    }
  };
}
