# Demo video — shot script

Hard limit 3:00. Target **2:40**, which leaves twenty seconds of slack for a
slow tool call. Public on YouTube, audio required, English.

Narration below is ~380 words. At a calm 150 wpm that is 2:32 of speech, so
there is room to pause. **Read it slower than feels right.** Rushing is the
most common way a good demo reads as panic.

## Before recording

- Chrome 149+ with `chrome://flags/#enable-webmcp-testing`, or ChatGPT in-app.
- `https://blindfold.blindfold.workers.dev` in a **fresh profile** — no
  IndexedDB state, so the surface really does start at three tools.
- Window at 1440×900. Browser chrome visible: judges want proof it is a page.
- The ToolsPanel open the whole time. It is the single most persuasive object
  on screen and it must never scroll out of frame.
- Type every prompt live. Pre-filled input reads as a fake.

---

## 0:00 — 0:14 · The problem

**Shot.** Full screen. Blindfold loaded, nothing open. ToolsPanel showing
**3 tools**.

> Redacted court filings get published every year with the names still in the
> file. Someone drew a black rectangle over the text instead of removing it.
> The obvious fix is to hand the document to an AI — which is the one thing
> nobody with a confidential document is allowed to do.

## 0:14 — 0:28 · The idea

**Shot.** Slow zoom to the ToolsPanel, three tool names legible.

> So Blindfold asks a narrower question. Can an agent redact a document it is
> never allowed to read? Everything here is WebMCP. Fourteen tools registered
> by the page itself, running on this device. Nothing is uploaded, and right
> now only three of them exist.

## 0:28 — 0:48 · Contextual registration

**Type.** `Open the leaked memo and tell me what it's about.`

**Shot.** Document appears; ToolsPanel visibly grows **3 → 5**. Hold two
seconds on the panel so the change is unmistakable.

> The agent opens it — and the tool surface changes underneath it. Two more
> tools exist now that a document does. A tool that is absent can't be called
> at the wrong time, so the order of the workflow is enforced by what exists,
> not by an error message.

## 0:48 — 1:12 · Masked findings

**Type.** `Find everything sensitive, then show me the people.`

**Shot.** Scan runs, 56 findings. Then the agent's `list_findings` reply, on
screen, block characters clearly visible.

> Fifty-six values found by a detector that runs in this page. And here is what
> the agent actually receives back. Type, page, confidence — and the value
> itself blocked out. It can plan over this perfectly well. It cannot read it.

## 1:12 — 1:38 · The disclosure gate

**Type.** `Is the sender a person or a company? Ask if you need to.`

**Shot.** The DisclosureGate appears with the agent's written reason. **Pause
two full seconds before clicking Allow.** Then the value reaching the agent.

> When it genuinely needs one real value, it has to ask — with a reason a
> person reads. And the tool call is suspended, right now, waiting for me.
> This is why it's WebMCP and not a server. Consent needs a screen and a human
> in front of it. A server has neither.

## 1:38 — 2:00 · Policy, plan, apply

**Type.** `Redact every person and address, keep the amounts. Show me the plan
first.`

**Shot.** Rule matches 37. Preview highlights the document. ConfirmGate with
its count. Click Apply.

> One sentence of policy, thirty-seven values. I see the plan on the document
> before I approve it, and the approval is mine.

## 2:00 — 2:22 · Proof

**Type.** `Prove nothing leaked.`

**Shot.** `clean: true`, 37 checked. Then the export gate, then the file.

> And it proves it — against the bytes of the exported file, not against what
> the screen draws. The characters were never written to the PDF. There is
> nothing under the rectangle to find.

## 2:22 — 2:36 · Prompt injection

**Shot.** Scroll the memo to the injected instruction, let it be readable for
a beat.

> One last thing. This memo contains an instruction aimed at the agent, telling
> it to keep everything and export immediately. It doesn't matter. Previews are
> masked, and nothing irreversible happens without a click. The document
> doesn't get a vote.

## 2:36 — 2:40 · Close

**Shot.** Back to the ToolsPanel. Live URL on screen.

> An agent that does the work, on a document it never sees.

---

## Recording notes

- One take per section, cut between. A single 2:40 take will fail on a slow
  call and you will re-record twenty times.
- If a tool takes longer than three seconds, cut the wait — but never cut the
  gate. The waiting **is** the demo.
- Do not narrate over a gate click. Let the click land in silence.
- Check the audio before recording the whole thing. Silent video is a fail.
