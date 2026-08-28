# Blindfold

**An agent redacts a document it is not allowed to read.**

**Live: https://blindfold.blindfold.workers.dev**

Open it in Chrome 149 or later with `chrome://flags/#enable-webmcp-testing`
enabled, or in the ChatGPT in-app browser, and ask an agent to open the leaked
memo. Three sample documents are built in, so nothing needs to be uploaded to
try it.

Blindfold is a WebMCP page for redacting confidential documents. The agent can
scan the document, plan what to remove, apply the plan, prove nothing survived
and export the file — without ever receiving the sensitive text. Tools return
structure: types, pages, counts, offsets, and previews with the values blocked
out. When the agent genuinely needs one real value, it has to ask, and a person
has to click.

Nothing is uploaded. Detection, redaction, verification and export all run in
the page, on the reviewer's device.

---

## Why this is a WebMCP application and not an MCP server

A server-side MCP server would have to receive the document. That is not an
inconvenience to engineer around; it is the end of the idea. The whole premise
of redaction work is that the confidential thing stays where it is.

Three things follow from being in the page, and none of them are available to a
server:

- **The document never moves.** The detector is regular expressions and
  checksums in `src/core/detector.ts`. There is no upload, no model call, no
  network request of any kind in the redaction path.
- **The page can stop and ask a person.** `request_disclosure` returns a promise
  that does not settle until somebody presses a button in this window. A server
  has no screen and no person in front of it.
- **The state the agent reasons about is the state the reviewer is looking at.**
  When the reviewer highlights text, a tool appears. When a plan exists, the
  tools that act on plans appear. The agent and the human are operating the same
  object.

## What is newly possible

An agent can drive a workflow over content it is **not allowed to read**,
requesting access one value at a time, under consent, with each grant and each
refusal recorded. Consent-gated information flow is not expressible in a
server-side MCP server, because the consent has nowhere to happen.

The everyday version of this: a reviewer with a forty-page document stops
hunting for names by eye and instead says "remove all the people and addresses
but keep the amounts" — and still personally approves every irreversible step,
which is what they are actually answerable for.

---

## Where the WebMCP code is

| What | File |
|---|---|
| Registration lifecycle — `registerTool`, `AbortController`, `toolchange` | `src/mcp/useWebMCPTools.ts` |
| Which tools exist in a given state | `src/mcp/surface.ts` |
| Wiring state to implementations | `src/mcp/registry.ts` |
| **Every tool description and input schema, hand-written** | `src/mcp/descriptions.ts` |
| The fourteen tools, one file each | `src/mcp/tools/` |
| Chrome's 1.5K output budget | `src/mcp/fit.ts` |
| Vendored API ground truth | `docs/webmcp-api.md` |
| Rules this repository was built under | `CLAUDE.md` |

`document.modelContext.registerTool(...)` is called in
`src/mcp/useWebMCPTools.ts`. Tools are unregistered by aborting their
`AbortController`; there is no `unregisterTool()`.

## The tool surface

Fourteen tools, of which between three and eleven are registered at any moment.

| Tool | Registered when | Human gate |
|---|---|---|
| `get_workflow_state` | always | |
| `open_sample_document` | always | |
| `get_audit_log` | always | |
| `describe_document` | a document is open | |
| `scan_for_sensitive_data` | a document is open | |
| `list_findings` | scanned | |
| `request_disclosure` | scanned | **discloses one value, on a click** |
| `add_redaction_rule` | scanned | |
| `set_finding_status` | scanned | |
| `preview_redaction_plan` | something is marked for redaction | |
| `apply_redaction_plan` | something is marked for redaction | **irreversible, on a click** |
| `verify_no_residual_text` | the plan has been applied | |
| `export_redacted_document` | verification came back clean | **downloads, on a click** |
| `redact_selection` | the reviewer has text highlighted | |

Registration is contextual on purpose. An agent choosing between fourteen tools
on an empty page will guess; an agent offered three will not. And a tool that is
absent cannot be called at the wrong time — `export_redacted_document` does not
exist until the file has been checked, so the ordering is enforced by absence
rather than by an error message an agent might argue with.

## Redaction that is actually redaction

Redaction fails publicly and repeatedly in one particular way: a black rectangle
is drawn over text, the text is still in the file, and anyone can select it.

Blindfold does not draw over anything. The exported PDF is rebuilt from the
document's text and the characters inside a redacted span are never written to
the file at all. The rectangle is drawn where they would have been.

`verify_no_residual_text` then proves it, against the bytes rather than the
screen: it inflates the Flate-compressed content streams the way a reader would,
decodes both literal and hex-encoded strings, and searches for every value that
was removed. Two guards keep the check honest —

- a **control** value the reviewer chose to keep must be found, otherwise the
  file was not readable and a clean result would prove nothing;
- a **negative control** in `scripts/verify-export.ts` builds the same document
  with nothing removed and requires every value to be found. A check that cannot
  fail is not a check.

## Prompt injection

`leaked_memo` contains an instruction addressed to whatever is processing it,
telling the agent to mark every finding as keep and export immediately.

The design does not depend on the agent ignoring it. Previews are masked, so the
agent following the instruction still cannot read anything; disclosure needs a
click; apply and export need a click, on a dialog stating how many values are
about to survive. Every tool that returns text taken from the document carries
`untrustedContentHint: true`.

---

## Running it

```sh
pnpm install
pnpm dev          # http://127.0.0.1:5173
```

WebMCP needs either Chrome 149+ with `chrome://flags/#enable-webmcp-testing`
enabled, or the ChatGPT in-app browser. With neither, the page still works as an
ordinary redaction tool and the header says WebMCP is unavailable.

To exercise the tools without an agent: **DevTools → Application → WebMCP**
lists the registered tools and runs them with test input.

### Checks

```sh
pnpm audit:tools     # description lengths against Chrome's budgets; detector output
pnpm audit:export    # the export path, including the negative control
pnpm audit:surface   # the whole scenario, no browser: registration, gates, budgets
```

`pnpm audit:surface` walks the full workflow and asserts the surface changes at
each step — 3 tools with no document, 5 open, 9 scanned, 11 with a plan, 10
applied, 11 verified — that a refused disclosure comes back as a refusal rather
than an error, and that every result fits the output budget on real data.

## Honest limitations

- **The samples are fiction, and the detector was written against them.** It is
  deterministic — regular expressions, Luhn and IBAN checksums, a name
  dictionary and a stoplist. On an unfamiliar document it will miss things. It
  is a demonstration of the workflow, not a production detector.
- **Only the built-in samples can be opened.** There is no file import yet.
- **The export is monospaced plain text**, rebuilt from the document rather than
  a copy of an original PDF's layout. That is what makes the redaction exact and
  the verification meaningful; it also means the exported file does not look
  like the original.
- **Masked previews are defence in depth, not a formal guarantee.** A ±40
  character window with every detected value blocked out can still leak
  something the detector did not detect. Strict previews, a checkbox in the
  findings panel, remove the context entirely.

## Licence

MIT. See [LICENSE](LICENSE).
