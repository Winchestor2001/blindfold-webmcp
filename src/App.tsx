import { useEffect } from "react";

import { AuditPanel } from "./ui/AuditPanel";
import { FindingsPanel } from "./ui/FindingsPanel";
import { Gates } from "./ui/Gates";
import { ToolsPanel } from "./ui/ToolsPanel";
import { Viewer } from "./ui/Viewer";

import { buildTools } from "./mcp/registry";
import { useWebMCPTools } from "./mcp/useWebMCPTools";
import { SAMPLES } from "./core/samples";
import {
  openDocument,
  resetSession,
  restore,
  setSelection,
  stageOf
} from "./state/store";
import { useStore } from "./state/useStore";

const STAGE_LABEL: Record<string, string> = {
  no_document: "no document",
  document_open: "open, not scanned",
  scanned: "scanned",
  applied: "redactions applied",
  verified: "verified — safe to export"
};

export default function App() {
  const state = useStore();

  // The tool surface is a function of state, recomputed on every render. The
  // registration hook only churns when the set of names changes, so this is
  // cheap and the two concerns stay separate.
  const status = useWebMCPTools(buildTools(state));

  useEffect(() => {
    void restore();
  }, []);

  // A selection that has been collapsed elsewhere on the page should stop
  // advertising redact_selection to the agent.
  useEffect(() => {
    const onChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setSelection(null);
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  const stage = stageOf(state);

  return (
    <div className="flex h-full flex-col bg-ink">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-slate-100">Blindfold</h1>
          <p className="text-[11px] text-muted">
            An agent redacts a document it is not allowed to read.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              status.supported ? "bg-human" : "bg-danger"
            }`}
          />
          <span className="text-muted">
            {status.supported ? `WebMCP · ${status.registered.length} tools` : "WebMCP unavailable"}
          </span>
        </div>

        <div className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">
          {STAGE_LABEL[stage]}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {SAMPLES.map((sample) => {
            const { blurb: _blurb, ...rest } = sample;
            return (
              <button
                key={sample.id}
                onClick={() => openDocument({ ...rest, source: "sample" }, "human")}
                className={`rounded border px-2.5 py-1 text-[11px] transition-colors ${
                  state.doc?.id === sample.id
                    ? "border-agent/60 bg-agent/10 text-agent"
                    : "border-line text-muted hover:text-slate-200"
                }`}
                title={sample.blurb}
              >
                {sample.title}
              </button>
            );
          })}
          <button
            onClick={resetSession}
            className="rounded border border-line px-2.5 py-1 text-[11px] text-muted hover:text-danger"
          >
            Reset
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 border-r border-line">
          <ToolsPanel status={status} />
        </aside>

        <section className="min-h-0">
          <Viewer state={state} />
        </section>

        <aside className="flex min-h-0 flex-col border-l border-line">
          <div className="min-h-0 flex-1">
            <FindingsPanel state={state} />
          </div>
          <div className="border-t border-line">
            <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted">
              Activity
            </h2>
            <AuditPanel state={state} />
          </div>
        </aside>
      </main>

      {state.selection && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-agent/50 bg-agent/10 px-4 py-1.5 text-[11px] text-agent">
          redact_selection is registered — the agent can act on what you highlighted
        </div>
      )}

      <Gates state={state} />
    </div>
  );
}
