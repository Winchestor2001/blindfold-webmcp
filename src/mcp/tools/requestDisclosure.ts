// request_disclosure — the one door through which a value can reach the agent.
//
// Everything else in this application is designed so that this call is rarely
// necessary. When it is necessary, it suspends: the promise returned by execute
// does not settle until a person clicks allow or refuse in the page, or two
// minutes pass. There is no default, no remembered answer, and no bulk grant.
//
// This is the part that cannot be built as an MCP server. A server-side tool has
// no screen to ask on and no person in front of it. Here the tool is running
// inside the reviewer's own page, so the page can stop and ask.

import { contract, requireScan } from "./shared";
import { findingById, record, requestDisclosure as ask } from "../../state/store";

export function requestDisclosure(): WebMCPTool {
  return {
    ...contract("request_disclosure"),
    execute: async (input, { signal }) => {
      const state = requireScan();
      const id = String(input.finding_id ?? "");
      const reason = String(input.reason ?? "").trim();

      const finding = findingById(id, state);
      if (!finding) {
        throw new Error(
          `There is no finding with id "${id}". Call list_findings to get current ids.`
        );
      }
      if (!reason) {
        throw new Error(
          "A reason is required. A person reads it before deciding, so say what the value is needed for."
        );
      }

      record("agent", "request_disclosure", `${finding.type} ${finding.id} — ${reason}`);
      const outcome = await ask(id, reason, signal);

      if (!outcome.granted) {
        return {
          finding: id,
          type: finding.type,
          page: finding.page,
          disclosed: false,
          reason: outcome.reason,
          // Refusal is a normal outcome, not a failure, and the agent should
          // carry on rather than retry the same request in a loop.
          guidance:
            "Continue from the type, page and confidence instead. Ask again only if you can give a different and more specific reason."
        };
      }

      return {
        finding: id,
        type: finding.type,
        page: finding.page,
        disclosed: true,
        value: outcome.value,
        handling:
          "Disclosed for this decision only. Do not repeat it back in summaries and do not use it as a key in later calls."
      };
    }
  };
}
