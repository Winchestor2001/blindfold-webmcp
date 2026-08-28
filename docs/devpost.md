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

### Inspiration

Redaction fails in public, over and over, in exactly one way: a black rectangle
is drawn over a name, the text is still in the file, and the first person to
press Ctrl+A reads it. Courts have published redacted filings that were not
redacted. So have governments.

The obvious fix is to hand the document to a model and let it do the work. That
is also the one thing a lawyer, a doctor or a compliance officer cannot do. The
document is the confidential thing. Uploading it to solve a confidentiality
problem is not a trade-off to negotiate; it is the end of the idea.

So we asked a narrower question: **can an agent do useful work on a document it
is never allowed to read?**

### What it does

Blindfold is a web page that registers fourteen WebMCP tools. An agent can scan
a document, plan what to remove, apply the plan, prove nothing survived and
export the file — without ever receiving the sensitive text.

Every tool returns structure instead of content: types, pages, counts,
character offsets, and previews with the values themselves replaced by blocks.

```
"…DENTIAL  Date: ████████████  From: Dr. ████████████, Chief Risk Officer…"
```

The agent can act on that perfectly well. "Remove every person and address but
keep the amounts" needs types and pages, not names.

When the agent genuinely needs one real value — telling a public company apart
from a private individual, say — it calls `request_disclosure` with a written
reason. That tool returns a promise that does not settle until a human presses
Allow or Refuse in the page. Refusal is a normal outcome, and the tool says so,
so the agent carries on with type and page instead of arguing.

This is the part that only WebMCP makes possible. Consent-gated information
flow needs a screen and a person in front of it. A server-side MCP server has
neither.

### How we built it

React 19 + Vite on Cloudflare Workers, and no backend at all — there is no
network request anywhere in the redaction path.

**Contextual registration.** The tool surface is not static. With nothing open,
three tools exist. Open a document and it is five; scan it, nine; mark something
for redaction, eleven; apply, ten; verify, eleven. `redact_selection` appears
only while the reviewer has text highlighted and disappears when they let go.
Registration follows app state through `document.modelContext.registerTool` and
`AbortController` — there is no `unregisterTool`; you abort the signal you
registered with.

That is not decoration. An agent choosing between fourteen tools on an empty
page will guess. An agent offered three will not. And a tool that is absent
cannot be called at the wrong time: `export_redacted_document` does not exist
until verification has come back clean, so the ordering is enforced by absence
rather than by an error message an agent might talk itself out of.

**Redaction that is actually redaction.** Blindfold does not draw over
anything. The exported PDF is rebuilt from the document's text, and the
characters inside a redacted span are never written to the file. The rectangle
is drawn where they would have been.

**Proof, not assertion.** `verify_no_residual_text` inflates the
Flate-compressed content streams of the export the way a reader would, decodes
both literal and hex strings, and searches for every removed value. Two guards
keep it honest: a control value the reviewer chose to *keep* must be found —
otherwise the file was unreadable and a clean result proves nothing — and a
negative control in the test suite builds the same document with nothing removed
and requires every value to be found. A check that cannot fail is not a check.

**Prompt injection is in the sample, on purpose.** `leaked_memo` contains an
instruction addressed to whatever is processing it, telling the agent to mark
everything as keep and export immediately. The design does not rely on the agent
ignoring it: previews are masked, so an agent that obeys still cannot read
anything; disclosure needs a click; apply and export need a click on a dialog
stating how many values are about to survive. Every tool returning
document-derived text carries `untrustedContentHint: true`.

### Challenges we ran into

**The API is younger than any model's training data.** Every model we asked
confidently wrote server-side MCP — `McpServer`, `server.tool()`, transports,
`{content:[{type:'text'}]}` — none of which exists here. We vendored the spec
and Chrome's docs into the repo and wrote a rule that API syntax may come from
that file and nowhere else. It is the single highest-leverage thing we did.

**Chrome cancels a tool call if the tool unregisters itself.** Three of our
tools take themselves off the surface by succeeding — once the plan is applied,
`apply_redaction_plan` is gone. The redaction visibly worked, and the agent was
told *"The operation failed for an unknown transient reason."* We kept a count
of in-flight calls and deferred removal until they finished. It still failed.
The measurement that cracked it: releasing the claim in a **microtask** after
`execute` returns still kills the call; releasing it one **task** later never
does. The fix is a `setTimeout(…, 0)` with a paragraph of comment above it
explaining why it cannot be anything faster.

**Chrome does not validate calls against `inputSchema`.** `additionalProperties:
false` is a hint to the model, not a gate. An undeclared key is dropped
silently, so `list_findings({page: 2})` answers about page 1 with no sign
anything was ignored. Wrong data that looks right is the worst failure this app
has available, so unknown parameters are refused with a message naming what the
tool accepts and which of those the caller probably meant.

**A rejected `execute` loses its message.** Chrome replaces it with its own
wording, so every error a model is supposed to act on is *returned* as a value
rather than thrown.

### What we learned

Tool descriptions are the interface, and they are prose. We hand-wrote all
fourteen and rewrote several three or four times, watching where an agent
misfired. The rewrites that worked said *when to reach for the tool*, named the
tool that comes next, and stated what is **not** returned so the agent stops
looking for it. Generated descriptions read fine and failed constantly.

We also learned that a human gate is a better design constraint than a safety
feature. Forcing every irreversible step through a click made us decide, for
each tool, exactly what the agent is entitled to know — and the answer was
almost always "less than we first wrote".

### What's next

File import, a real layout-preserving export, and a detector that is not tuned
to its own samples. The README says plainly which of those are limitations
today.

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
