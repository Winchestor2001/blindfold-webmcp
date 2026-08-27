import { ALL_TOOL_NAMES } from "../mcp/registry";
import { TOOL_SPECS } from "../mcp/descriptions";
import type { WebMCPStatus } from "../mcp/useWebMCPTools";

/**
 * The live tool surface.
 *
 * Contextual registration is invisible by nature — the agent simply sees a
 * different list — so the page shows it. Watching tools appear as a document is
 * opened, scanned and applied is the clearest single demonstration that this is
 * a WebMCP application and not a page with a chat box bolted on.
 */
export function ToolsPanel({ status }: { status: WebMCPStatus }) {
  const registered = new Set(status.registered);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Tool surface</h2>
        <p className="mt-1 text-xs text-muted">
          {status.supported ? (
            <>
              <span className="text-human">{registered.size}</span> of {ALL_TOOL_NAMES.length}{" "}
              registered right now
            </>
          ) : (
            <span className="text-danger">
              document.modelContext not available — enable chrome://flags/#enable-webmcp-testing
            </span>
          )}
        </p>
      </div>

      <ul className="flex-1 overflow-y-auto px-2 py-2">
        {ALL_TOOL_NAMES.map((name) => {
          const live = registered.has(name);
          return (
            <li
              key={name}
              className={`rounded px-2 py-1.5 font-mono text-[11px] transition-colors ${
                live ? "text-slate-100" : "text-muted/50"
              }`}
              title={TOOL_SPECS[name].description}
            >
              <span
                className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                  live ? "bg-human" : "bg-line"
                }`}
              />
              {name}
            </li>
          );
        })}
      </ul>

      {status.error && (
        <p className="border-t border-line px-4 py-2 text-xs text-danger">{status.error.message}</p>
      )}
    </div>
  );
}
