import type { Actor } from "../core/types";

/**
 * Who did this. The whole product rests on the reviewer being able to tell an
 * agent's proposal from their own decision at a glance, so the distinction is
 * carried everywhere rather than mentioned once.
 */
export function ActorBadge({ actor }: { actor: Actor | null }) {
  if (!actor) {
    return <span className="text-[10px] uppercase tracking-wider text-muted">undecided</span>;
  }
  const agent = actor === "agent";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        agent ? "bg-agent/15 text-agent" : "bg-human/15 text-human"
      }`}
    >
      {agent ? "agent" : "you"}
    </span>
  );
}
