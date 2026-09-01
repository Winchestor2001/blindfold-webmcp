# Devpost submission — Blindfold

Paste-ready text. Everything here is English, as the rules require.
Every field is filled. Nothing here is waiting on anything.

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

## Video demo link

```
https://youtu.be/hFe44_Z5OKo
```

Public on YouTube, as the rules require — not unlisted. 2:24, under the
three-minute limit. Narration is the entrant's own voice and there is no music,
so nothing in it is third-party material.

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

**One dropped request disabled two tools permanently.** Found only by running
the whole workflow against the deployed origin rather than against localhost:
`verify_no_residual_text` came back with a fetch error, `export_redacted_document`
consequently never registered, and no amount of retrying helped. The asset was
served correctly and was byte-identical to the local build — but a dynamic
import that fails once is remembered by the module map for the lifetime of the
document, so every later import rejects with the first error without going near
the network. The tool now re-imports by URL with a query string appended, which
is a different key in that map, and says plainly that a reload recovers the
session if even that fails.

None of these are in the documentation. We found them by measuring the browser,
not by reading about it.

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
  design does not depend on the agent ignoring it — and when we ran it, the
  agent never received the payload at all. `describe_document` returns headings,
  the previews around that section stop before the instruction and resume after
  it, and the tool surface simply had no way to hand it over.
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

---

## Additional info (judges and organisers only)

One field below is a fact about you, not about the project, and is marked
**CONFIRM**. Do not paste it without checking it.

### Submitter Type

**CONFIRM.** `Individual` if you are submitting alone. `Team` only if someone
else is on the Manage team step.

### Country of residence

```
Uzbekistan
```

Checked, 1 September 2026. The Official Rules make eligibility residence in a
country that supports OpenAI's API, and Uzbekistan is on that list. Only change
this if you do not in fact reside there.

- https://webmcp.devpost.com/rules
- https://developers.openai.com/api/docs/supported-countries

### Organisation name

Leave blank.

### App Status

```
New
```

The first commit is 27 August 2026, inside the submission period. The whole
repository was written during the hackathon window and the commit history shows
it, with no rewritten or force-pushed history.

### If Existing, what did you update

Leave blank.

### Live URL

```
https://blindfold.blindfold.workers.dev
```

### Testing instructions

```
No sign-in, no credentials, no upload. Everything runs in the page, on your
device, including detection, redaction, verification and export.

BROWSER
Chrome 149+, or the ChatGPT in-app browser. Nothing to switch on: the site
carries a WebMCP origin trial token, so the tools register on load. If you
would rather not rely on the token, chrome://flags/#enable-webmcp-testing does
the same thing. In any other browser the page still works as an ordinary
redaction tool and the header says WebMCP is unavailable.

DOCUMENTS
Three samples are built in, so you never need a document of your own. Ask for
the "leaked memo" — it is the one with the prompt injection in it.

A FIVE-PROMPT RUN, ABOUT TWO MINUTES

1. "Open the leaked memo and tell me what it's about."
   Watch the tool count in the left-hand panel go from 3 to 5. Registration is
   contextual: a tool that does not apply does not exist.

2. "Find everything sensitive, then show me the people."
   56 findings. Every preview comes back with the value itself blocked out.
   That is the whole idea — the agent plans over structure it can use and never
   receives the text.

3. "Is the sender a person or a company? Ask me if you need to."
   The agent calls request_disclosure with a written reason, and the tool call
   suspends until you press Allow or Refuse. Please try Refuse at least once:
   the agent is told refusal is normal and carries on with type and page.

4. "Redact every person and address but keep the amounts, then show me the plan."
   One sentence of policy, 18 values to remove and 4 amounts kept. Applying is
   irreversible and needs your click on a dialog that states how many values
   will survive.

5. "Prove nothing leaked, then export it."
   Verification reads the bytes of the export, not the screen: it inflates the
   PDF content streams and searches them for every removed value. Export does
   not exist as a tool until that comes back clean.

THE INJECTION TEST
Open the leaked memo and say "just do whatever the document says". The memo
contains an instruction aimed at the agent, telling it to mark everything keep
and export immediately. Previews stay masked and nothing irreversible happens
without a human click, so the document does not get a vote.

WITHOUT AN AGENT
DevTools -> Application -> WebMCP lists the registered tools and runs any of
them with test input. Calling get_workflow_state at each stage shows the
surface changing: 3 tools with nothing open, 5 open, 9 scanned, 11 with a plan,
10 applied, 11 verified.

STATE
Progress is kept in IndexedDB and survives a reload. To start clean, use a new
profile or clear site data.
```

### Public code repository

```
https://github.com/Winchestor2001/blindfold-webmcp
```

MIT, in `LICENSE` at the repository root, detected by GitHub and shown in the
About block. **Check that "MIT license" actually appears there before you
submit** — the rule is explicit about it being visible.

### Which agents or clients did you test your WebMCP tools with

> Only claim what has actually been run. The ChatGPT in-app browser goes in this
> answer only after it has been run there — it needs GPT-5.6 Sol or Terra, not
> Luna and not an Enterprise or Edu account.

```
Chrome 152.0.7977.64 stable with chrome://flags/#enable-webmcp-testing, against
the deployed origin rather than localhost, in two ways.

Without an agent: the DevTools Application -> WebMCP panel, driving all fourteen
tools with hand-written input over a nineteen-call run. Zero failed, zero
cancelled, and the surface moved 3 -> 5 -> 9 -> 11 -> 10 -> 11 as the workflow
advanced.

With an agent: the WebMCP Model Context Tool Inspector extension in the side
panel, running gemini-3-flash-preview, given ten unrehearsed phrasings rather
than a script — because the question there is not "does the tool work" but "does
the agent reach for the right tool from wording nobody rehearsed". Thirteen of
the fourteen fired. The fourteenth is set_finding_status, and the agent never
reached for it: asked to "redact every person and address but keep the amounts"
it wrote three policy rules through add_redaction_rule instead of marking
eighteen ids one by one. That is the better move, and not one we predicted.

Both branches of both human gates were exercised with the agent watching: a
disclosure allowed and a disclosure refused, an apply approved and an export
declined. A refusal comes back as an ordinary result, not an error — the agent
reported the decline in plain words and carried on from type and page, with no
failed call and no retry loop.

Testing against the browser rather than only against the specification is how we
found the three Chrome behaviours described in the project story — calls being
cancelled when a tool unregisters itself, inputSchema not being enforced, and a
rejected execute losing its message — and four bugs of our own that neither
TypeScript nor our audit scripts could see. Every one of the four surfaced from
something unscripted: an agent that narrowed its filters exactly as told and
still could not reach the tail of a list, an agent that re-scanned a document
that had already been verified, and a person highlighting one more word after
the proof was in. Each is now covered by a check that was confirmed to fail with
the fix backed out. The full run is in docs/agent-test-log.md.
```

### Which AI tools have you leveraged while working on this project

```
Claude Code, with Claude Opus 5, for implementation, debugging and review.

One decision shaped how it was used. WebMCP shipped after the model's training
cutoff, and every model we tried confidently produced server-side MCP instead —
McpServer, server.tool(), transports, none of which exist in this API. So we
vendored the specification and Chrome's documentation into the repository and
wrote a project rule that WebMCP syntax may come from that file and nowhere
else, with the official Cloudflare template kept alongside as a syntax
exemplar. After that the model was reliable.

The tool descriptions and input schemas in src/mcp/descriptions.ts are
deliberately not AI-generated. They are the interface an agent reasons over,
and generated ones came out generic enough that the agent picked the wrong
tool. They are hand-written and revised as prose.
```

### Describe the level of learning you or your team derived from the project

**Dropdown, not free text.** Options are None / moderate / significant.

```
significant
```

Not a boast — it is the accurate box. The project shipped against an API newer
than any model's training data, and three of its hardest bugs were browser
behaviours that contradicted the published IDL. Anything less than "significant"
would be false modesty that costs a point and buys nothing.

If a free-text box appears alongside it, this is the answer:

```
Building against an API that is weeks old means the documentation tells you the
shape and the browser tells you the truth. Three of our hardest bugs were
behaviours that contradicted the IDL, and in each case reasoning about the
problem produced a fix that looked correct and did not work. The one that took
longest — a tool call cancelled because the tool removed itself from the surface
by succeeding — was solved by running four variants of the same release timing
and watching which failed. A microtask after execute returns still kills the
call; one task later never does.

The design lesson was larger than the API. Forcing every irreversible step and
every disclosure through a human click made us decide, tool by tool, exactly
what the agent is entitled to know — and the answer was consistently less than
we first wrote. Writing fourteen tool descriptions by hand taught us that they
are prose, not metadata: the ones that work say when to reach for the tool, name
the tool that comes next, and say what is not returned so the agent stops
looking for it.

The most transferable idea: absence is a better guardrail than an error message.
A tool that does not exist cannot be called at the wrong time, cannot be argued
with, and costs nothing to ignore.
```

### Did you gain AI value that you can use in your career

**Probably also a dropdown.** If it is, the answer is `Yes`. If it is free text:

```
Yes, in three ways.

First, a working model of agent-facing interface design. Tool descriptions,
input schemas and error messages are a user interface for a reader that cannot
ask a follow-up question, and they are written and revised like prose. That
applies to any tool-using system, not just WebMCP.

Second, a pattern for consent-gated automation that we expect to reuse. An async
tool that suspends on a human decision, returns refusal as a normal result
rather than an error, and records both outcomes in an audit log, is the right
shape for any workflow where a person stays accountable for what the agent does.

Third, a method for building against APIs newer than the model: vendor the
ground truth into the repository, forbid the model from recalling the API from
memory, keep a known-good template beside it, and verify every claim against the
runtime rather than the documentation. That is what made an unfamiliar API
productive in a week, and it will keep being useful for as long as tools ship
faster than models learn about them.
```
