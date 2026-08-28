# Blindfold — working rules

An AI that redacts a document it is not allowed to read.
Submission for the WebMCP Challenge (Devpost), deadline 2026-09-03 13:00 PT.

## Rule 1 — WebMCP API syntax comes from one place only

`docs/webmcp-api.md` is the **only** permitted source of WebMCP API syntax.
`reference/webmcp-react/` is a working official template kept as a syntax exemplar.

Do not write WebMCP API calls from memory. The standard shipped after the model's training
cutoff and the model reliably confuses it with **server-side MCP**, which is a different thing.

Forbidden, because they do not exist in this project:

- `@modelcontextprotocol/sdk`, `McpServer`, `server.tool(...)`, any transport
- returning `{ content: [{ type: 'text', text }] }` from a tool
- `navigator.modelContext` (deprecated in Chrome 150 — use `document.modelContext`)
- `unregisterTool()` (does not exist — abort the `AbortController` passed at registration)

If you need an API detail that is not in `docs/webmcp-api.md`, look it up in the live docs
linked at the bottom of that file and **add it to that file first**, then use it.

## Rule 2 — Tool descriptions and input schemas are hand-written

All `description` and `inputSchema` values live in `src/mcp/descriptions.ts` and are authored
by hand, not generated. They are the interface the agent reasons over and half of the
"WebMCP Leverage" judging criterion. Generated descriptions come out generic and the agent
misfires on them.

Chrome budgets: description ≤500 chars, parameter description ≤150, names ≤30, output ≤1.5K.

## Rule 3 — Every tool is verified in the browser before it is called done

1. DevTools → Application → WebMCP → select the tool → fill parameters → **Run tool**.
2. Then with a real agent in Chrome 149+ using a natural phrasing.
3. Rewrite the description at least three times, watching where the agent misfires.

The model cannot see how an agent interprets its own descriptions. Do not skip this.

## Rule 4 — Commit often, with real dates

Commit history is the evidence that the project was built during the hackathon window
(2026-08-25 → 2026-09-03). Never force-push or rewrite history.

## Rule 5 — From 2026-09-01, fixes only

No new features after 2026-09-01. Do not rewrite anything that already works.
A broken button costs more than a missing feature under the "Execution" criterion.

## Rule 6 — The privacy invariant

Tools must never return raw sensitive values to the agent. Findings are returned masked.
The only path from a sensitive value to the agent is `request_disclosure`, which suspends
until a human clicks Reveal in the UI.

Any tool whose output contains text derived from the document sets
`annotations: { untrustedContentHint: true }`. The document is untrusted input: it may
contain prompt injection aimed at the agent.

Before adding or changing a tool, ask: can this leak a value the human has not released?

## Project shape

| Path | What |
|---|---|
| `docs/webmcp-api.md` | vendored API ground truth — Rule 1 |
| `reference/webmcp-react/` | official Cloudflare template, syntax exemplar |
| `src/mcp/descriptions.ts` | hand-written descriptions + input schemas |
| `src/mcp/tools/` | one file per tool |
| `src/mcp/useWebMCPTool.ts` | registerTool + AbortController lifecycle |
| `src/core/detector.ts` | local entity detection, deterministic, no ML |
| `src/core/redact.ts` | rasterise + pdf-lib export |
| `src/core/verify.ts` | residual-text proof |
| `src/state/` | app state + IndexedDB persistence |
| `src/ui/` | viewer, findings panel, disclosure gate, confirm gate |

## Commands

```
pnpm install
pnpm dev        # local, http://localhost:5173
pnpm build
pnpm run deploy # Cloudflare Workers (bare `pnpm deploy` is pnpm's own command)
```
