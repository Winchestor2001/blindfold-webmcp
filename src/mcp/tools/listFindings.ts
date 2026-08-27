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

      const matched = state.findings.filter((finding) => {
        if (types.length > 0 && !types.includes(finding.type)) return false;
        if (pages.length > 0 && !pages.includes(finding.page)) return false;
        if (status && finding.status !== status) return false;
        return true;
      });

      const entries = matched.slice(0, limit).map((finding) => ({
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

      return fitList(entries, (shown, omitted) => ({
        matched: matched.length,
        returned: shown.length,
        not_returned: matched.length - shown.length,
        findings: shown,
        // The agent cannot see that a result was trimmed unless it is told, and
        // an agent that thinks it has seen everything will stop looking.
        note:
          matched.length > shown.length
            ? `${matched.length - shown.length} more findings match. Narrow by type, page or status rather than asking for a larger limit.`
            : undefined,
        trimmed_for_output_budget: omitted > 0 || undefined,
        values: "masked — call request_disclosure for a specific value, with a reason"
      }));
    }
  };
}
