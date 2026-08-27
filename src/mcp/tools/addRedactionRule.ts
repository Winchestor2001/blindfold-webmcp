// add_redaction_rule — one decision applied to everything that matches.
//
// People give redaction instructions as policy: "take out all the names", "keep
// the amounts", "everything on page two goes". Making the agent turn that into
// a list of forty ids is work it will get wrong, and it hides the intent from
// the audit log. A rule keeps the shape of the instruction.
//
// The label is built here rather than asked for. Chrome's guidance is not to
// make the model perform string transformations, and a label the agent writes
// is a label that can drift from what the rule actually does.

import { contract, requireScan } from "./shared";
import { addRule } from "../../state/store";
import { ENTITY_TYPES, type EntityType } from "../../core/types";

function label(types: EntityType[], pages: number[], action: "redact" | "keep"): string {
  const verb = action === "redact" ? "Redact" : "Keep";
  const what = types.length > 0 ? types.join(", ") : "every type";
  const where =
    pages.length === 0
      ? "throughout the document"
      : pages.length === 1
        ? `on page ${pages[0]}`
        : `on pages ${pages.join(", ")}`;
  return `${verb} ${what} ${where}`;
}

export function addRedactionRule(): WebMCPTool {
  return {
    ...contract("add_redaction_rule"),
    execute: async (input) => {
      requireScan();

      const known = new Set<string>(ENTITY_TYPES);
      const requested = Array.isArray(input.types) ? input.types.map(String) : [];
      const unknown = requested.filter((entry) => !known.has(entry));
      if (unknown.length > 0) {
        throw new Error(
          `Unknown entity type ${unknown.map((entry) => `"${entry}"`).join(", ")}. The types are ${ENTITY_TYPES.join(", ")}.`
        );
      }

      const action = input.action === "keep" ? "keep" : "redact";
      const types = requested as EntityType[];
      const pages = Array.isArray(input.pages) ? input.pages.map(Number) : [];

      const { rule, matched } = addRule({
        types,
        pages,
        action,
        label: label(types, pages, action),
        createdBy: "agent"
      });

      return {
        rule: rule.id,
        reads_as: rule.label,
        matched: matched.length,
        // Returned so a following call can inspect or override individual
        // findings without listing the whole document again.
        finding_ids: matched.slice(0, 25),
        finding_ids_truncated: matched.length > 25 || undefined,
        note:
          matched.length === 0
            ? "Nothing matched. Call list_findings with no filters to see which types and pages actually occur."
            : "A later rule wins over an earlier one where they overlap. Use set_finding_status to override individual findings."
      };
    }
  };
}
