// Shared plumbing for the tool implementations.
//
// Two rules hold across every tool in this directory:
//
//   1. The contract — name, title, description, inputSchema, annotations — is
//      never written here. It comes from src/mcp/descriptions.ts, which is
//      hand-authored and reviewed as prose. See CLAUDE.md, Rule 2.
//   2. Errors are written for a reader who can act on them. Chrome's guidance is
//      that a model should be able to correct itself from the message alone, so
//      every failure says what went wrong and which tool fixes it.

import { TOOL_SPECS, type ToolName } from "../descriptions";
import { getState, type State } from "../../state/store";
import type { LoadedDocument } from "../../core/types";

export function contract(name: ToolName): Omit<WebMCPTool, "execute"> {
  const spec = TOOL_SPECS[name];
  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: spec.annotations
  };
}

/**
 * Guards that a document is open.
 *
 * The surface already hides document tools when nothing is open, so reaching
 * this is either a stale reference or a race. Either way the agent needs to be
 * told how to get back to a state where the call makes sense.
 */
export function requireDocument(state: State = getState()): LoadedDocument {
  if (!state.doc) {
    throw new Error(
      "No document is open. Call open_sample_document to open one of the built-in samples, then try again."
    );
  }
  return state.doc;
}

export function requireScan(state: State = getState()): State {
  requireDocument(state);
  if (!state.scanned) {
    throw new Error(
      "The document has not been scanned yet, so there are no findings to work with. Call scan_for_sensitive_data first."
    );
  }
  return state;
}

/** Page text by page number, for the tools that need to build previews. */
export function pageText(doc: LoadedDocument, page: number): string {
  return doc.pages.find((candidate) => candidate.number === page)?.text ?? "";
}

/** Counts by entity type, in descending order, as a plain object. */
export function histogram(types: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}
