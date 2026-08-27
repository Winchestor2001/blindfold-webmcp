import { useSyncExternalStore } from "react";

import { getState, subscribe, type State } from "./store";

/**
 * The UI reads the same store the tools write to.
 *
 * This is why an agent's action and a person's action look identical on screen
 * and identical in the audit log: there is one set of operations, and both go
 * through it. The store is deliberately not React state — tools are registered
 * at module scope and have no component to hang off.
 */
export function useStore(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}
