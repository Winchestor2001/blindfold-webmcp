import { ActorBadge } from "./Badge";
import type { State } from "../state/store";

/**
 * The record. Reversed, because the question is nearly always "what just
 * happened". Values never appear here, in the panel or in the exported copy of
 * the same log.
 */
export function AuditPanel({ state }: { state: State }) {
  if (state.audit.length === 0) {
    return <div className="px-4 py-3 text-xs text-muted">Nothing has happened yet.</div>;
  }

  return (
    <ul className="max-h-56 overflow-y-auto">
      {[...state.audit].reverse().map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="flex gap-2 border-b border-line/40 px-4 py-1.5">
          <span className="font-mono text-[10px] text-muted">{entry.at.slice(11, 19)}</span>
          <ActorBadge actor={entry.actor} />
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10.5px] text-slate-300">{entry.action}</span>
            <span className="ml-2 text-[10.5px] text-muted">{entry.detail}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
