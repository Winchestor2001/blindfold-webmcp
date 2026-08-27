// preview_redaction_plan — show the person what is about to happen.
//
// This tool changes nothing in the document, but it does change the screen: the
// viewer switches into plan view, dimming what is staying and lighting up what
// would be removed. That is the point. Approval on the next step only means
// something if the reviewer has seen what they are approving, and the agent
// cannot show them anything except by asking the page to.

import { contract, requireScan } from "./shared";
import { fitList } from "../fit";
import { planCounts, record, setPreviewing } from "../../state/store";

export function previewRedactionPlan(): WebMCPTool {
  return {
    ...contract("preview_redaction_plan"),
    execute: async () => {
      const state = requireScan();
      const marked = state.findings.filter((finding) => finding.status === "redact");

      if (marked.length === 0) {
        throw new Error(
          "Nothing is marked for redaction, so there is no plan to preview. Call list_findings with status \"unreviewed\" to see candidates, then add_redaction_rule or set_finding_status."
        );
      }

      setPreviewing(true);
      record("agent", "preview_redaction_plan", `${marked.length} findings highlighted`);

      const byPage = state.doc!.pages.map((page) => {
        const onPage = marked.filter((finding) => finding.page === page.number);
        const types = new Map<string, number>();
        for (const finding of onPage) types.set(finding.type, (types.get(finding.type) ?? 0) + 1);
        return {
          page: page.number,
          removing: onPage.length,
          types: Object.fromEntries([...types.entries()].sort((a, b) => b[1] - a[1]))
        };
      });

      const counts = planCounts(state);
      return fitList(byPage, (shown, omitted) => ({
        removing: marked.length,
        keeping: counts.keep,
        unreviewed: counts.unreviewed,
        by_page: shown,
        pages_omitted_for_length: omitted || undefined,
        shown_on_screen: true,
        note:
          counts.unreviewed > 0
            ? `${counts.unreviewed} findings have no decision and will be left in the document.`
            : "Every finding has a decision. Call apply_redaction_plan when the reviewer is ready."
      }));
    }
  };
}
