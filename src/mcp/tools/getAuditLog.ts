// get_audit_log — who decided what.
//
// Redaction is a decision someone is answerable for, so the record of it has to
// survive the session and has to distinguish the agent's proposals from the
// human's approvals. Entries hold finding ids and types; never values. The same
// log is written onto the audit page of the exported PDF.

import { contract } from "./shared";
import { fitList } from "../fit";
import { getState } from "../../state/store";

export function getAuditLog(): WebMCPTool {
  return {
    ...contract("get_audit_log"),
    execute: async () => {
      const state = getState();
      // Most recent first: questions about an audit log are almost always about
      // what just happened.
      const entries = [...state.audit].reverse().map((entry) => ({
        at: entry.at.slice(11, 19),
        by: entry.actor,
        action: entry.action,
        detail: entry.detail
      }));

      return fitList(entries, (shown, omitted) => ({
        total: entries.length,
        by_agent: state.audit.filter((entry) => entry.actor === "agent").length,
        by_human: state.audit.filter((entry) => entry.actor === "human").length,
        entries: shown,
        older_entries_not_shown: omitted || undefined,
        note: "Most recent first. Times are this session's clock. Values are never recorded."
      }));
    }
  };
}
