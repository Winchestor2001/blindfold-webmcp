// redact_selection — act on what the reviewer is pointing at.
//
// This tool is registered only while text is selected in the viewer, and that
// conditional presence is the feature. When the agent can see this tool, it
// knows a person is indicating something specific on screen, and "redact this"
// resolves without either side having to name an id or quote the text — which
// matters here, because quoting the text would disclose it.

import { contract, requireDocument } from "./shared";
import { addManualFinding, getState } from "../../state/store";
import { ENTITY_TYPES, type EntityType } from "../../core/types";

export function redactSelection(): WebMCPTool {
  return {
    ...contract("redact_selection"),
    execute: async (input) => {
      const state = getState();
      requireDocument(state);

      const selection = state.selection;
      if (!selection) {
        throw new Error(
          "Nothing is selected in the viewer any more, so there is no 'this' to redact. Ask the reviewer to highlight the text again, or use set_finding_status with a finding id."
        );
      }

      const type = String(input.type ?? "");
      if (!(ENTITY_TYPES as string[]).includes(type)) {
        throw new Error(
          `"${type}" is not an entity type. The types are ${ENTITY_TYPES.join(", ")}.`
        );
      }

      const finding = addManualFinding(selection, type as EntityType, "agent");

      // Dropping the highlight is what takes this tool off the surface, and
      // Chrome cancels a call whose tool is unregistered while it is still
      // running — the agent gets "failed for an unknown transient reason" for
      // work that in fact succeeded. So the highlight is released on a later
      // task, after this result has gone back, and the app's own
      // selectionchange listener clears the state the same way it does when a
      // person clicks elsewhere on the page.
      if (typeof window !== "undefined") {
        setTimeout(() => window.getSelection()?.removeAllRanges(), 0);
      }

      return {
        finding: finding.id,
        type: finding.type,
        page: finding.page,
        status: finding.status,
        characters: finding.end - finding.start,
        note: "Recorded as a redaction and added to the plan. The value is not returned."
      };
    }
  };
}
