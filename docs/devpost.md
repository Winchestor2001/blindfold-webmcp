# Devpost submission — Blindfold

Paste-ready text. Everything here is English, as the rules require.
Fill the video link on 3 September; everything else is stable now.

---

## Project name

```
Blindfold
```

## Elevator pitch (200 characters)

```
An agent redacts a document it is not allowed to read. WebMCP tools return only structure — masked previews, counts, pages. Every real value and every irreversible step waits for a human click.
```

## Try it out links

```
https://blindfold.blindfold.workers.dev
https://github.com/Winchestor2001/blindfold-webmcp
```

## Built with

```
webmcp, chrome, react, typescript, vite, tailwind, pdf-lib, cloudflare-workers, indexeddb
```

---

## About the project

Paste everything between the rules below into the Devpost editor. It is
Markdown, which the editor accepts, and it uses Devpost's own seven headings.

---

## Inspiration

Redacted court filings get published every year with the names still in the
file. Someone drew a black rectangle over the text instead of removing it, and
the first person to press Ctrl+A read everything. Governments have done it.
Law firms have done it. It keeps happening because the tool that draws the
rectangle and the tool that owns the text are not the same tool.

The obvious modern fix is to hand the document to a model and let it find every
name. That is also the one thing a lawyer, a doctor or a compliance officer is
not allowed to do. The document *is* the confidential thing. Uploading it to
solve a confidentiality problem is not a trade-off to negotiate — it is the end
of the idea.

So we asked a narrower question, and it turned out to be the interesting one:

**Can an agent do useful work on a document it is never allowed to read?**

## What it does

Blindfold is a web page that registers fourteen WebMCP tools. An agent can scan
a document, decide what to remove, apply the plan, prove nothing survived and
export the file — without ever receiving the sensitive text.

Every tool returns structure instead of content: types, pages, counts, character
offsets, and previews with the values themselves blocked out.

```
PERSON  p.1  conf 0.91  "…Date: ████████████  From: Dr. ████████████, Chief Risk Officer…"
```

An agent can plan over that perfectly well. *"Remove every person and address
but keep the amounts"* needs types and pages — it never needed the names.

When the agent genuinely needs one real value — telling a public company apart
from a private individual, say — it calls `request_disclosure` with a written
reason. That tool returns a promise **that does not settle until a human presses
Allow or Refuse in the page**. The tool call is suspended, live, waiting for a
person. Refusal is a normal outcome and the tool says so, so the agent carries
on with type and page instead of arguing about it.

Everything runs on the device. There is no upload, no model call and no network
request of any kind in the redaction path.

## How we built it

React 19 and Vite on Cloudflare Workers, and no backend at all.

**The tool surface is not static.** With nothing open, three tools exist. Open a
document and it is five. Scan it, nine. Mark something for redaction, eleven.
Apply, ten. Verify, eleven. `redact_selection` appears only while the reviewer
has text highlighted and disappears when they let go. Registration follows app
state through `document.modelContext.registerTool` and `AbortController` —
there is no `unregisterTool`, you abort the signal you registered with.

That is not decoration. An agent choosing between fourteen tools on an empty
page will guess; an agent offered three will not. And a tool that is absent
cannot be called at the wrong time — `export_redacted_document` does not exist
until verification has come back clean — so the order of the workflow is
enforced by what exists rather than by an error message an agent might talk
itself out of.

**Redaction that is actually redaction.** Blindfold does not draw over anything.
The exported PDF is rebuilt from the document's text, and the characters inside
a redacted span are never written to the file at all. The rectangle is drawn
where they would have been. There is nothing underneath to recover.

**Proof rather than assertion.** `verify_no_residual_text` inflates the
Flate-compressed content streams of the export the way a PDF reader would,
decodes both literal and hex-encoded strings, and searches for every value that
was removed. Two guards keep the check honest: a control value the reviewer
chose to *keep* must be found — otherwise the file was unreadable and a clean
result would prove nothing — and a negative control in the test suite builds the
same document with nothing removed and requires every value to be found. **A
check that cannot fail is not a check.**

**The detector is deterministic on purpose.** Regular expressions, a Luhn check
for cards, mod-97 for IBANs, a name dictionary and a stoplist. No model, no WASM
download, no network. It is auditable and it is instant, and the README says
plainly where it will miss things.

## Challenges we ran into

**The API is younger than any model's training data.** Every model we asked
confidently wrote *server-side* MCP — `McpServer`, `server.tool()`, transports,
`{content:[{type:'text'}]}` — none of which exists in WebMCP. We vendored the
spec and Chrome's documentation into the repository and wrote a rule that API
syntax may come from that file and nowhere else. It was the single
highest-leverage decision in the project.

**Chrome cancels a tool call if the tool unregisters itself.** Three of our
tools take themselves off the surface *by succeeding* — once the plan is
applied, `apply_redaction_plan` no longer belongs on the surface. The redaction
visibly worked, and the agent was told *"The operation failed for an unknown
transient reason."* We kept a count of in-flight calls and deferred the removal
until they finished. It still failed. The measurement that finally cracked it:
releasing the claim in a **microtask** after `execute` returns still kills the
call; releasing it one **task** later never does. The fix is a
`setTimeout(…, 0)` with a paragraph above it explaining why it cannot be
anything faster.

**Chrome does not validate a call against `inputSchema`.** `additionalProperties:
false` is a hint to the model, not a gate. An undeclared key is dropped in
silence, so `list_findings({page: 2})` answers about page 1 with no sign that
anything was ignored. Wrong data that looks right is the worst failure this app
has available, so unknown parameters are now refused with a message naming what
the tool accepts and which of those the caller probably meant.

**A rejected `execute` loses its message.** Chrome replaces it with its own
wording, so everything the tool wanted to say is gone. Every error a model is
supposed to act on is therefore *returned* as a value, never thrown.

None of the three are in the documentation. We found them by measuring the
browser, not by reading about it.

## Accomplishments that we're proud of

- **The privacy invariant holds end to end.** Fourteen tools, and not one of
  them can hand the agent a value a human has not released. It is not a policy
  we ask the model to respect; there is no code path.
- **A tool call that suspends on a person.** The agent is genuinely blocked,
  mid-call, until someone clicks. Consent-gated information flow is not
  expressible in a server-side MCP server, because the consent has nowhere to
  happen.
- **The export is verifiable, and the verifier can fail.** Two controls, one
  positive and one negative, so a clean result means something.
- **Prompt injection is in the sample, deliberately.** `leaked_memo` contains an
  instruction telling the agent to keep everything and export immediately. The
  design does not depend on the agent ignoring it.
- **Three undocumented Chrome behaviours found, worked around, and written
  down** in the source with the measurements that produced them.

## What we learned

**Tool descriptions are the interface, and they are prose.** We hand-wrote all
fourteen rather than generating them. The ones that worked said *when to reach
for the tool*, named the tool that comes next so chains are discoverable, and
stated what is **not** returned so the agent stops looking for it. Generated
descriptions read fine and misfire constantly.

**A human gate is a better design constraint than a safety feature.** Forcing
every irreversible step through a click made us decide, tool by tool, exactly
what the agent is entitled to know. The answer was almost always *less than we
first wrote*.

**Absence is a better guardrail than an error.** A tool that does not exist
cannot be misused, cannot be argued with, and costs the agent no tokens to
ignore.

**Measure the browser.** Two of our three worst bugs were behaviours that
contradicted the IDL. Reasoning about them produced a fix that looked right and
did not work.

## What's next for Blindfold

- **File import.** Today only the three built-in samples open, so that a judge
  can reach the interesting part in one call without finding a confidential
  document of their own.
- **Layout-preserving export.** The current export is rebuilt as monospaced
  text, which is what makes the redaction exact and the verification
  meaningful — but the file no longer looks like the original.
- **A detector that is not tuned to its own samples.** The current one is a
  demonstration of the workflow, not a production detector, and the README says
  so.
- **`exposedTo` for partner origins**, so a document management system could
  drive a redaction session in an embedded Blindfold without ever holding the
  document itself.

---

## The four required questions

**Why did you use WebMCP for this project?**

Because the document must never leave the device. A server-side MCP server would
have to receive the confidential file, which destroys the premise rather than
inconveniencing it. Detection, redaction, verification and export all run in the
page. And the consent gate — an agent suspended mid-call until a person clicks —
needs a screen and a human, which a server does not have.

**How does WebMCP make the user experience better?**

A reviewer with a forty-page document stops hunting for names by eye. They say
"remove all the people and addresses but keep the amounts" and the agent turns
that into a plan over 56 detected values. They still personally approve every
disclosure and every irreversible step, which is what they are actually
answerable for. The agent does the search; the human keeps the judgement.

**What is newly possible that was not before?**

An agent driving a complete workflow over content it is **not allowed to read**,
requesting access one value at a time under human consent, with every grant and
every refusal recorded in an audit log. Consent-gated information flow is not
expressible in a server-side MCP server, because the consent has nowhere to
happen.

**How did you implement it?**

Fourteen imperative tools registered through
`document.modelContext.registerTool`, lifecycle-managed with `AbortController`
and reconciled against app state so between three and eleven are exposed at any
moment. Two classes of human gate — disclosure and destructive — implemented as
an `execute` that suspends on a promise until the UI resolves it.
`untrustedContentHint: true` on every document-derived output. Self-correcting
error messages returned as values, because a thrown one is replaced by the
browser. All tool descriptions and input schemas hand-written and kept inside
Chrome's character budgets by a test.

Registration lives in `src/mcp/useWebMCPTools.ts`; the descriptions are
`src/mcp/descriptions.ts`; the fourteen tools are one file each under
`src/mcp/tools/`.
