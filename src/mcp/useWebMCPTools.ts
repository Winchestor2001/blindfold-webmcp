import { useEffect, useRef, useState } from "react";

// WebMCP registration lifecycle.
//
// Blindfold's tool surface is deliberately not static: which tools exist depends
// on whether a document is open, whether it has been scanned, whether a plan has
// been applied, and whether the user currently has text selected. See CLAUDE.md.
//
// Two problems have to be solved at once:
//
//   1. The set of registered tools must follow app state, adding and removing
//      individual tools without tearing down the whole surface.
//   2. A tool's execute must always see current state, but re-registering on
//      every state change would thrash the agent's view of the page.
//
// The fix is to register a stable wrapper per tool name and dispatch through a
// ref. Registration then only churns when the shape of the surface changes.

export type WebMCPStatus = {
  /** The browser exposes document.modelContext. */
  supported: boolean;
  /** Names currently registered, in registration order. */
  registered: string[];
  error: Error | null;
};

const noTools: string[] = [];

/** A signal that stays unaborted, for callers that supplied none. */
function neverAborts(): AbortSignal {
  return new AbortController().signal;
}

/** Edit distance, used only to name the parameter a caller probably meant. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const carried = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = carried;
    }
  }
  return row[b.length];
}

/**
 * Complains about parameters the tool does not accept.
 *
 * Chrome does not validate a call against inputSchema, so `additionalProperties:
 * false` is a hint to the model and nothing more until the code enforces it. An
 * undeclared key is otherwise dropped in silence and the agent reads an
 * unfiltered answer as a filtered one: list_findings({page: 2}) replies with
 * page 1 and no sign that anything was ignored. Wrong data that looks right is
 * the worst failure available to this app, so the call is refused and the
 * message names what the tool does accept, and which of those the caller most
 * likely meant.
 */
function parameterComplaint(
  name: string,
  schema: unknown,
  input: Record<string, unknown>
): string | null {
  if (!schema || typeof schema !== "object") return null;
  const shape = schema as { additionalProperties?: unknown; properties?: unknown };
  if (shape.additionalProperties !== false) return null;
  if (!shape.properties || typeof shape.properties !== "object") return null;

  const accepted = Object.keys(shape.properties as object);
  const unknown = Object.keys(input).filter((key) => !accepted.includes(key));
  if (unknown.length === 0) return null;

  const listed = unknown.map((key) => `"${key}"`).join(", ");
  const takes =
    accepted.length === 0
      ? `${name} takes no parameters.`
      : `${name} accepts ${accepted.join(", ")}.`;

  const suggestions = unknown
    .map((key) => {
      const near = accepted
        .map((candidate) => ({ candidate, gap: distance(key, candidate) }))
        .sort((a, b) => a.gap - b.gap)[0];
      return near && near.gap <= 3 ? `"${key}" may be "${near.candidate}"` : null;
    })
    .filter((hint): hint is string => hint !== null);

  const hint = suggestions.length ? ` ${suggestions.join("; ")}.` : "";
  return `${listed} is not a parameter of ${name}, so the call was refused rather than answered from the wrong arguments. ${takes}${hint}`;
}

export function useWebMCPTools(tools: WebMCPTool[]): WebMCPStatus {
  // Latest definitions, read at call time so execute never closes over stale state.
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  // name -> controller, so tools can be unregistered individually.
  const activeRef = useRef(new Map<string, AbortController>());

  // registerTool is asynchronous, so two runs of the effect can otherwise
  // overlap and reconcile the same map at the same time. React's StrictMode
  // makes that happen on every mount in development, and the symptom is a tool
  // silently missing from the surface. Runs are chained instead: each waits for
  // the previous one to finish before touching anything.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const [status, setStatus] = useState<WebMCPStatus>({
    supported: false,
    registered: noTools,
    error: null
  });

  // Only the shape of the surface drives re-registration.
  const shape = tools.map((tool) => tool.name).join(" ");

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setStatus({ supported: false, registered: noTools, error: null });
      return;
    }

    const active = activeRef.current;
    const wanted = shape ? shape.split(" ") : [];
    let cancelled = false;

    async function reconcile() {
      if (cancelled) return;

      // Remove tools that no longer belong to the current context.
      const keep = new Set(wanted);
      for (const [name, controller] of active) {
        if (!keep.has(name)) {
          controller.abort();
          active.delete(name);
        }
      }

      for (const name of wanted) {
        // Re-checked every iteration: an earlier await may have changed both.
        if (cancelled) return;
        if (active.has(name)) continue;

        const definition = toolsRef.current.find((tool) => tool.name === name);
        if (!definition) continue;

        const controller = new AbortController();
        // Claim the slot before awaiting so nothing else registers this name.
        active.set(name, controller);

        const wrapper: WebMCPTool = {
          name: definition.name,
          title: definition.title,
          description: definition.description,
          inputSchema: definition.inputSchema,
          annotations: definition.annotations,
          execute: async (input, options) => {
            const current = toolsRef.current.find((tool) => tool.name === name);
            if (!current) {
              // Removed between the agent's discovery and this call.
              return {
                error: `The tool "${name}" is not available in the current state of the page.`,
                guidance:
                  "Call get_workflow_state to see which tools apply right now."
              };
            }
            const complaint = parameterComplaint(
              name,
              current.inputSchema,
              (input ?? {}) as Record<string, unknown>
            );
            if (complaint) return { error: complaint };

            try {
              // The IDL declares both arguments, but a caller that passes no
              // AbortSignal of its own — executeTool without options, and the
              // DevTools WebMCP panel — reaches the callback with options
              // undefined. The three tools that wait on a human would throw
              // while destructuring. Standing in a signal that never aborts is
              // honest: there is nothing for the caller to cancel with.
              return await current.execute(input ?? {}, {
                signal: options?.signal ?? neverAborts()
              });
            } catch (caught) {
              // A rejected execute reaches the caller as Chrome's own wording —
              // "Tool was executed but the invocation failed" — and whatever the
              // tool wanted to say is gone. Every message this app raises is
              // written for a model to act on, so they are returned as values
              // instead. The docs put it plainly: return descriptive errors so
              // the model can self-correct and retry.
              return {
                error:
                  caught instanceof Error
                    ? caught.message
                    : `${name} could not complete this call.`
              };
            }
          }
        };

        try {
          await modelContext!.registerTool(wrapper, { signal: controller.signal });
        } catch (caught) {
          active.delete(name);
          if (controller.signal.aborted) continue;
          setStatus((previous) => ({
            ...previous,
            supported: true,
            error:
              caught instanceof Error
                ? caught
                : new Error(`Failed to register "${name}".`)
          }));
          continue;
        }
      }

      if (cancelled) return;
      setStatus({ supported: true, registered: [...active.keys()], error: null });
    }

    queueRef.current = queueRef.current.then(reconcile, reconcile);

    return () => {
      cancelled = true;
    };
  }, [shape]);

  // Unregister everything when the app goes away. Queued behind any reconcile
  // still in flight, so it cannot abort a controller that is mid-registration.
  useEffect(() => {
    const active = activeRef.current;
    const queue = queueRef;
    return () => {
      queue.current = queue.current.then(() => {
        for (const controller of active.values()) controller.abort();
        active.clear();
      });
    };
  }, []);

  return status;
}
