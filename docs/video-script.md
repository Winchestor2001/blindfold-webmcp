# Demo video — shot script

Hard limit 3:00. Target **2:40**. Public on YouTube, audio required, English.

Devpost's own advice shapes this cut, and two rules override instinct:

- **Show it working in the first 15 seconds.** No title card, no problem
  statement first. The hook is the product.
- **Cut live typing, load times and dead air.** Type the prompts for real while
  recording, then jump-cut the typing out in the edit so the prompt appears and
  the answer follows. Never cut a human gate — the waiting *is* the demo.

Narration is ~370 words. At a calm 150 wpm that is 2:28 of speech, leaving room
to breathe. **Read it slower than feels right.**

## Before recording

- Chrome 149+ with `chrome://flags/#enable-webmcp-testing`, or ChatGPT in-app.
- `https://blindfold.blindfold.workers.dev` in a **fresh profile** — no
  IndexedDB state, so the surface really does start at three tools.
- Window at 1440×900. Browser chrome visible: judges want proof it is a page.
- ToolsPanel open throughout. It is the most persuasive object on screen and it
  must never scroll out of frame.
- Record in short clips, one per section. A single 2:40 take will fail on a
  slow call and you will re-record twenty times.

---

## 0:00 — 0:14 · Cold open, already working

**Shot.** Mid-workflow. `list_findings` has just returned and the masked
previews are on screen, block characters large and legible. No preamble.

> This is an agent that has just found fifty-six confidential values in a
> document. And this is everything it received back. Type, page, confidence —
> and the value itself blocked out. It is redacting a document it is not
> allowed to read.

## 0:14 — 0:26 · Why that matters

**Shot.** Quick cut to the memo, then back.

> Redacted filings get published every year with the names still in the file,
> because someone drew a rectangle instead of removing the text. The obvious
> fix is to hand the document to an AI — the one thing nobody with a
> confidential document may do. So the document never leaves this page.

## 0:26 — 0:44 · Contextual registration

**Shot.** Cut back to the start: nothing open, ToolsPanel showing **3 tools**.
Prompt appears — *"Open the leaked memo"* — document loads, panel grows to
**5**. Hold two seconds on the panel.

> All of this is WebMCP. Fourteen tools registered by the page itself — and
> right now only three of them exist. Open a document and two more appear. A
> tool that is absent can't be called at the wrong time, so the order of the
> workflow is enforced by what exists, not by an error message.

## 0:44 — 1:04 · What the agent gets

**Shot.** *"Find everything sensitive, then show me the people."* Scan runs,
56 findings, panel grows to **9**. Masked previews again.

> The detector runs here, on this device. Fifty-six values, and the agent can
> plan over all of them — remove the people, keep the amounts — without ever
> receiving a name.

## 1:04 — 1:30 · The disclosure gate

**Shot.** *"Is the sender a person or a company? Ask me if you need to."* The
DisclosureGate appears with the agent's written reason. **Two full seconds of
silence before clicking Allow.**

> When it genuinely needs one real value, it has to ask — with a reason a
> person reads. And the tool call is suspended, right now, waiting for me.
> This is why it's WebMCP and not a server. Consent needs a screen and a human
> in front of it. A server has neither.

## 1:30 — 1:52 · Policy, plan, apply

**Shot.** *"Redact every person and address, keep the amounts. Show me the plan
first."* Rule matches 37. Preview highlights the document. ConfirmGate with its
count. Click Apply.

> One sentence of policy, thirty-seven values. I see the plan on the document
> before I approve it — and the approval is mine.

## 1:52 — 2:14 · Proof

**Shot.** *"Prove nothing leaked, then export it."* `clean: true`, 37 checked.
Export gate, then the file.

> And it proves it against the bytes of the exported file, not against what the
> screen draws. The characters were never written to the PDF. There is nothing
> under the rectangle to find.

## 2:14 — 2:30 · Prompt injection

**Shot.** Scroll the memo to the injected instruction. Let it be readable for a
beat.

> One last thing. This memo contains an instruction aimed at the agent, telling
> it to keep everything and export immediately. It doesn't matter. Previews are
> masked, and nothing irreversible happens without a click. The document
> doesn't get a vote.

## 2:30 — 2:40 · Close

**Shot.** ToolsPanel. Live URL on screen.

> Fourteen tools, and not one of them can hand the agent something a person
> hasn't released. An agent that does the work, on a document it never sees.

---

## Editing checklist

- First frame shows the product working. No logo, no title card.
- Every typing animation cut. Every loading spinner cut.
- **No gate cut.** The pause before a click is the point of the film.
- Audio checked before recording the whole thing. A silent video is a fail.
