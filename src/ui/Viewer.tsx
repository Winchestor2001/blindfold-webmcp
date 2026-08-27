import { useCallback } from "react";

import { setSelection, type State } from "../state/store";
import type { Finding } from "../core/types";

// The document, and what is about to happen to it.
//
// Text is rendered in a monospaced face on purpose: it is the same face the
// export uses, so what the reviewer approves on screen is laid out the way the
// file will be. Once a plan is applied, redacted spans are drawn as blocks and
// the characters behind them are gone from the DOM as well as from the file —
// there is nothing to select.

type Segment = {
  start: number;
  end: number;
  text: string;
  finding: Finding | null;
};

/** Splits a page into runs, one per finding and one per gap between them. */
function segmentsFor(text: string, findings: Finding[]): Segment[] {
  const ordered = [...findings].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const finding of ordered) {
    if (finding.start < cursor) continue;
    if (finding.start > cursor) {
      segments.push({
        start: cursor,
        end: finding.start,
        text: text.slice(cursor, finding.start),
        finding: null
      });
    }
    segments.push({
      start: finding.start,
      end: finding.end,
      text: text.slice(finding.start, finding.end),
      finding
    });
    cursor = finding.end;
  }

  if (cursor < text.length) {
    segments.push({ start: cursor, end: text.length, text: text.slice(cursor), finding: null });
  }
  return segments;
}

function classFor(finding: Finding, previewing: boolean, applied: boolean): string {
  if (finding.status === "redact") {
    if (applied) return "bg-slate-950 text-transparent select-none rounded-[2px]";
    return previewing
      ? "bg-danger/30 text-danger-foreground ring-1 ring-danger/60 rounded-[2px]"
      : "bg-danger/20 rounded-[2px]";
  }
  if (finding.status === "keep") return "underline decoration-human/50 decoration-dotted";
  return previewing ? "opacity-40" : "bg-agent/10 rounded-[2px]";
}

/** Walks up to the nearest run and turns a DOM position into a page offset. */
function offsetOf(node: Node | null, within: number): number | null {
  let element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  while (element && element.dataset.offset === undefined) element = element.parentElement;
  if (!element) return null;
  return Number(element.dataset.offset) + within;
}

function pageOf(node: Node | null): number | null {
  let element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  while (element && element.dataset.page === undefined) element = element.parentElement;
  return element ? Number(element.dataset.page) : null;
}

export function Viewer({ state }: { state: State }) {
  // Selecting text registers redact_selection, so the agent can act on "this
  // one" without anybody having to say the value out loud.
  const onSelect = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !state.doc) {
      setSelection(null);
      return;
    }

    const page = pageOf(selection.anchorNode);
    if (page === null || page !== pageOf(selection.focusNode)) {
      setSelection(null);
      return;
    }

    const anchor = offsetOf(selection.anchorNode, selection.anchorOffset);
    const focus = offsetOf(selection.focusNode, selection.focusOffset);
    if (anchor === null || focus === null) {
      setSelection(null);
      return;
    }

    const start = Math.min(anchor, focus);
    const end = Math.max(anchor, focus);
    const text = state.doc.pages.find((candidate) => candidate.number === page)?.text.slice(start, end) ?? "";
    if (text.trim().length === 0) {
      setSelection(null);
      return;
    }
    setSelection({ page, start, end, text });
  }, [state.doc]);

  if (!state.doc) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div className="max-w-md">
          <h2 className="text-lg font-medium text-slate-200">No document open</h2>
          <p className="mt-2 text-sm text-muted">
            Ask the agent to open one — “open the leaked memo” — or pick a sample above. Nothing you
            open is uploaded anywhere; the detector, the redaction and the export all run in this
            page.
          </p>
        </div>
      </div>
    );
  }

  const applied = state.applied !== null;

  return (
    <div className="h-full overflow-y-auto px-6 py-6" onMouseUp={onSelect}>
      {state.doc.pages.map((page) => {
        const findings = state.findings.filter((finding) => finding.page === page.number);
        return (
          <article key={page.number} data-page={page.number} className="mx-auto mb-6 max-w-3xl">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-muted">
              Page {page.number} of {state.doc!.pages.length}
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-line bg-panel px-5 py-5 font-mono text-[12.5px] leading-[1.55] text-slate-200">
              {segmentsFor(page.text, findings).map((segment) => {
                if (!segment.finding) {
                  return (
                    <span key={segment.start} data-offset={segment.start}>
                      {segment.text}
                    </span>
                  );
                }
                const hidden = applied && segment.finding.status === "redact";
                return (
                  <span
                    key={segment.start}
                    data-offset={segment.start}
                    title={`${segment.finding.type} · ${segment.finding.id} · ${segment.finding.status}`}
                    className={classFor(segment.finding, state.previewing, applied)}
                  >
                    {hidden ? "█".repeat(segment.text.length) : segment.text}
                  </span>
                );
              })}
            </pre>
          </article>
        );
      })}
    </div>
  );
}
