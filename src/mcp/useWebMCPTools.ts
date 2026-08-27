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
          execute: (input, options) => {
            const current = toolsRef.current.find((tool) => tool.name === name);
            if (!current) {
              // Removed between the agent's discovery and this call.
              throw new Error(
                `The tool "${name}" is not available in the current state of the page. Call get_workflow_state to see which tools apply right now.`
              );
            }
            return current.execute(input, options);
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
