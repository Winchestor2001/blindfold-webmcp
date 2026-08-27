// set_finding_status — individual judgement, in batches.
//
// The batch shape is deliberate. An agent given a per-id tool will call it forty
// times, which is forty chances to drift and forty entries in the audit log for
// what was one decision.

import { contract, requireScan } from "./shared";
import { planCounts, record, setStatuses } from "../../state/store";

export function setFindingStatus(): WebMCPTool {
  return {
    ...contract("set_finding_status"),
    execute: async (input) => {
      requireScan();

      const ids = Array.isArray(input.finding_ids) ? input.finding_ids.map(String) : [];
      if (ids.length === 0) {
        throw new Error(
          "No finding ids were given. Call list_findings to get ids, then pass them together in finding_ids."
        );
      }

      const status = input.status === "keep" ? "keep" : "redact";
      const { updated, unknown } = setStatuses(ids, status, "agent");
      record(
        "agent",
        "set_finding_status",
        `${updated.length} findings marked ${status}`
      );

      const counts = planCounts();
      return {
        updated: updated.length,
        unknown_ids: unknown,
        plan: counts,
        note:
          unknown.length > 0
            ? "Some ids were not recognised. Ids change when the document is re-scanned, so call list_findings again."
            : counts.unreviewed > 0
              ? `${counts.unreviewed} findings are still unreviewed and will stay in the document. Anything that must go needs an explicit redact.`
              : undefined
      };
    }
  };
}
