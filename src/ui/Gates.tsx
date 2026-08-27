import { useState } from "react";

import {
  answerConfirmation,
  answerDisclosure,
  findingById,
  type State
} from "../state/store";

// The two places where the agent has to stop and wait for a person.
//
// Both are implemented the same way: the tool's execute returns a promise that
// does not settle until a button here is pressed, or a timeout passes. No
// default answer, nothing remembered between calls, no way to pass a flag that
// skips them. This is the part of the design that a server-side MCP cannot have,
// because a server has no screen to ask on.

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-line bg-panel shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function DisclosureGate({ state }: { state: State }) {
  const request = state.disclosures[0];
  const [reason, setReason] = useState("");
  if (!request) return null;

  const finding = findingById(request.findingId, state);
  const pageText =
    state.doc?.pages.find((page) => page.number === finding?.page)?.text ?? "";
  const context = finding
    ? pageText.slice(Math.max(0, finding.start - 60), finding.end + 60).replace(/\s+/g, " ").trim()
    : "";

  return (
    <Shell>
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-sm font-medium text-agent">The agent is asking to see one value</h2>
        <p className="mt-0.5 text-xs text-muted">
          It cannot read this without you. Nothing is disclosed unless you press the button.
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-muted">Its reason</p>
        <p className="mt-1 rounded border border-line bg-ink/60 px-3 py-2 text-sm text-slate-200">
          {request.reason}
        </p>

        {finding && (
          <>
            <p className="mt-4 text-[11px] uppercase tracking-wider text-muted">
              What it would receive — {finding.type}, page {finding.page}
            </p>
            <p className="mt-1 rounded border border-line bg-ink/60 px-3 py-2 font-mono text-sm text-slate-100">
              {finding.value}
            </p>
            <p className="mt-2 font-mono text-[10.5px] leading-snug text-muted">…{context}…</p>
          </>
        )}

        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="If you refuse, you can say why (optional)"
          className="mt-4 w-full rounded border border-line bg-ink/60 px-3 py-2 text-xs text-slate-200 placeholder:text-muted/70 focus:border-agent focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <button
          onClick={() =>
            answerDisclosure(
              request.id,
              false,
              reason.trim() || undefined
            )
          }
          className="rounded border border-line px-3 py-1.5 text-xs text-muted hover:text-slate-200"
        >
          Refuse
        </button>
        <button
          onClick={() => answerDisclosure(request.id, true)}
          className="rounded bg-agent px-3 py-1.5 text-xs font-medium text-ink hover:bg-agent/90"
        >
          Disclose this value
        </button>
      </div>
    </Shell>
  );
}

function ConfirmGate({ state }: { state: State }) {
  const request = state.confirms[0];
  if (!request) return null;

  return (
    <Shell>
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-sm font-medium text-danger">{request.headline}</h2>
        <p className="mt-0.5 text-xs text-muted">
          The agent has asked for this and is waiting. It cannot proceed on its own.
        </p>
      </div>

      <ul className="px-5 py-4 text-sm text-slate-200">
        {request.details.map((detail) => (
          <li key={detail} className="mb-1.5 flex gap-2">
            <span className="text-muted">—</span>
            <span>{detail}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <button
          onClick={() => answerConfirmation(request.id, false)}
          className="rounded border border-line px-3 py-1.5 text-xs text-muted hover:text-slate-200"
        >
          Not now
        </button>
        <button
          onClick={() => answerConfirmation(request.id, true)}
          className="rounded bg-danger px-3 py-1.5 text-xs font-medium text-ink hover:bg-danger/90"
        >
          {request.kind === "apply" ? "Remove them" : "Download"}
        </button>
      </div>
    </Shell>
  );
}

/** Disclosure first: it is the smaller commitment, and it may inform the other. */
export function Gates({ state }: { state: State }) {
  if (state.disclosures.length > 0) return <DisclosureGate state={state} />;
  if (state.confirms.length > 0) return <ConfirmGate state={state} />;
  return null;
}
