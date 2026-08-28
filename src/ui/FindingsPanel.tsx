import { ActorBadge } from "./Badge";
import { previewFor } from "../core/mask";
import {
  planCounts,
  record,
  setStatuses,
  setStrictPreviews,
  type State
} from "../state/store";
import type { Finding } from "../core/types";

// What was found, and who decided what about it.
//
// The reviewer sees real values here — it is their document, on their machine.
// The agent, calling list_findings against the same store, sees the masked
// preview shown underneath. Putting both on screen at once is the clearest way
// to say what the agent does and does not have.

function Preview({ state, finding }: { state: State; finding: Finding }) {
  const text = state.doc?.pages.find((page) => page.number === finding.page)?.text ?? "";
  return (
    <p className="mt-1 break-words font-mono text-[10.5px] leading-snug text-muted">
      {previewFor(
        text,
        finding,
        state.findings.filter((other) => other.page === finding.page),
        state.strictPreviews
      )}
    </p>
  );
}

export function FindingsPanel({ state }: { state: State }) {
  const counts = planCounts(state);

  if (!state.scanned) {
    return (
      <div className="px-4 py-4 text-xs text-muted">
        Nothing scanned yet. Ask the agent to “find everything sensitive”, and the detector runs
        here, in this page.
      </div>
    );
  }

  const decide = (finding: Finding, status: "redact" | "keep") => {
    setStatuses([finding.id], status, "human");
    record("human", "set_finding_status", `${finding.id} marked ${status}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Findings</h2>
          <span className="text-xs text-muted">{state.findings.length}</span>
        </div>
        <div className="mt-2 flex gap-3 text-[11px]">
          <span className="text-danger">{counts.redact} redact</span>
          <span className="text-human">{counts.keep} keep</span>
          <span className="text-muted">{counts.unreviewed} undecided</span>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={state.strictPreviews}
            onChange={(event) => setStrictPreviews(event.target.checked)}
            className="accent-agent"
          />
          Strict previews — the agent sees no surrounding words at all
        </label>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {state.findings.map((finding) => (
          <li key={finding.id} className="border-b border-line/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted">{finding.id}</span>
              <span className="text-[11px] font-medium text-slate-200">{finding.type}</span>
              <span className="text-[10px] text-muted">p{finding.page}</span>
              {finding.confidence <= 0.6 && (
                <span className="text-[10px] text-amber-400" title="The detector is guessing">
                  low confidence
                </span>
              )}
              <span className="ml-auto">
                <ActorBadge actor={finding.decidedBy} />
              </span>
            </div>

            <p className="mt-1 break-words font-mono text-[11.5px] text-slate-300">{finding.value}</p>
            <Preview state={state} finding={finding} />

            <div className="mt-1.5 flex gap-1.5">
              <button
                onClick={() => decide(finding, "redact")}
                className={`rounded px-2 py-0.5 text-[10px] ${
                  finding.status === "redact"
                    ? "bg-danger/25 text-danger"
                    : "bg-line/60 text-muted hover:text-slate-200"
                }`}
              >
                redact
              </button>
              <button
                onClick={() => decide(finding, "keep")}
                className={`rounded px-2 py-0.5 text-[10px] ${
                  finding.status === "keep"
                    ? "bg-human/20 text-human"
                    : "bg-line/60 text-muted hover:text-slate-200"
                }`}
              >
                keep
              </button>
              {finding.ruleId && (
                <span className="self-center text-[10px] text-muted">by rule {finding.ruleId}</span>
              )}
              {finding.disclosed && (
                <span className="self-center text-[10px] text-agent">disclosed</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
