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
    const desired = new Set(shape ? shape.split(" ") : []);
    let cancelled = false;

    // Remove tools that no longer belong to the current context.
    for (const [name, controller] of active) {
      if (!desired.has(name)) {
        controller.abort();
        active.delete(name);
      }
    }

    // Add tools that appeared.
    const additions = toolsRef.current.filter((tool) => !active.has(tool.name));

    async function register() {
      for (const definition of additions) {
        const controller = new AbortController();
        // Claim the slot before awaiting so a concurrent run cannot double-register.
        active.set(definition.name, controller);

        const wrapper: WebMCPTool = {
          name: definition.name,
          title: definition.title,
          description: definition.description,
          inputSchema: definition.inputSchema,
          annotations: definition.annotations,
          execute: (input, options) => {
            const current = toolsRef.current.find(
              (tool) => tool.name === definition.name
            );
            if (!current) {
              // Removed between the agent's discovery and this call.
              throw new Error(
                `The tool "${definition.name}" is not available in the current state of the page. Call get_workflow_state to see which tools apply right now.`
              );
            }
            return current.execute(input, options);
          }
        };

        try {
          await modelContext!.registerTool(wrapper, {
            signal: controller.signal
          });
        } catch (caught) {
          active.delete(definition.name);
          if (cancelled || controller.signal.aborted) return;
          setStatus((previous) => ({
            ...previous,
            supported: true,
            error:
              caught instanceof Error
                ? caught
                : new Error(`Failed to register "${definition.name}".`)
          }));
          continue;
        }
      }

      if (cancelled) return;
      setStatus({
        supported: true,
        registered: [...active.keys()],
        error: null
      });
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, [shape]);

  // Unregister everything when the app unmounts.
  useEffect(() => {
    const active = activeRef.current;
    return () => {
      for (const controller of active.values()) controller.abort();
      active.clear();
    };
  }, []);

  return status;
}
