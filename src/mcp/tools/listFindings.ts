// list_findings — the findings, without the values.
//
// This is the tool an agent lives in, and it is where the privacy invariant is
// most easily broken by accident. Every entry carries an id, a type, a page, a
// confidence and a preview in which the value itself — and every other detected
// value near it — is replaced by blocks. `Finding.value` is never serialised
// here. The only route to a real value is request_disclosure, and that route
// runs through a human.

import { contract, pageText, requireScan } from "./shared";
import { fitList } from "../fit";
import { previewFor } from "../../core/mask";
import type { EntityType, FindingStatus } from "../../core/types";
import { ENTITY_TYPES } from "../../core/types";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 40;

function asTypes(value: unknown): EntityType[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(ENTITY_TYPES);
  const chosen = value.map(String).filter((entry) => known.has(entry));
  const unknown = value.map(String).filter((entry) => !known.has(entry));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown entity type ${unknown.map((entry) => `"${entry}"`).join(", ")}. The types are ${ENTITY_TYPES.join(", ")}.`
    );
  }
  return chosen as EntityType[];
}

export function listFindings(): WebMCPTool {
  return {
    ...contract("list_findings"),
    execute: async (input) => {
      const state = requireScan();
      const doc = state.doc!;

      const types = asTypes(input.types);
      const pages = Array.isArray(input.pages) ? input.pages.map(Number) : [];
      const status = input.status as FindingStatus | undefined;
      const limit = Math.min(
        Math.max(Number(input.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
        MAX_LIMIT
      );
      const offset = Math.max(Number(input.offset ?? 0) || 0, 0);

      const matched = state.findings.filter((finding) => {
        if (types.length > 0 && !types.includes(finding.type)) return false;
        if (pages.length > 0 && !pages.includes(finding.page)) return false;
        if (status && finding.status !== status) return false;
        return true;
      });

      const entries = matched.slice(offset, offset + limit).map((finding) => ({
        id: finding.id,
        type: finding.type,
        page: finding.page,
        confidence: finding.confidence,
        status: finding.status,
        preview: previewFor(
          pageText(doc, finding.page),
          finding,
          state.findings.filter((other) => other.page === finding.page),
          state.strictPreviews
        )
      }));

      return fitList(entries, (shown, omitted) => {
        const next = offset + shown.length;
        const remaining = Math.max(matched.length - next, 0);
        return {
          matched: matched.length,
          returned: shown.length,
          offset: offset || undefined,
          not_returned: remaining,
          findings: shown,
          // The agent cannot see that a result was trimmed unless it is told, and
          // an agent that thinks it has seen everything will stop looking. Naming
          // the next offset matters as much as the count: told only to narrow its
          // filters, an agent that has already narrowed to one page and one type
          // has nowhere left to go, and gives up believing it has seen the list.
          note:
            remaining > 0
              ? `${remaining} more match. Call again with offset ${next} for the next ones, or narrow by type, page or status.`
              : undefined,
          trimmed_for_output_budget: omitted > 0 || undefined,
          values: "masked — call request_disclosure for a specific value, with a reason"
        };
      });
    }
  };
}
