# Demo video — narration, keyed to the cut

The cut exists: `blindfold-demo.mp4`, **1920×1080, 30 fps, 2:24 exactly**, silent.
It is one unattended take. Nothing in it is staged in an editor — the beats below
are where they actually fall in the file, read off the finished video.

Read the narration over it. **Every timestamp is a hard cue**, and the word
counts are sized so each block lands inside its beat at a calm 150 words per
minute. Total is ~296 words against 144 seconds, which leaves roughly fifteen
seconds of silence spread through the film. That silence is deliberate: the two
gates need a beat where nothing is said and the viewer watches the call wait.

**Read it slower than feels right.**

---

## 0:00 · Three of fourteen  (21 words)

Nothing open. The tool surface shows `3 of 14 registered right now`; the
greyed-out names below are the eleven that do not exist yet. At 0:04 the first
prompt lands and the memo opens; the panel goes to five.

> Fourteen WebMCP tools live on this page. With nothing open, three of them
> exist. Open a document and two more appear.

## 0:10 · What the agent is told  (19 words)

*"What am I looking at?"* — `describe_document` returns kind, pages and an
entity histogram.

> The agent asks what it is looking at, and gets a shape. Types, pages, counts —
> never the text.

## 0:18 · The scan  (16 words)

*"Find everything sensitive."* — the panel goes to nine tools, 56 findings.

> The detector runs here, on this device. Nothing is uploaded. Fifty-six
> confidential values, found in seconds.

## 0:26 · What comes back  (29 words)

*"Show me the people you found."* — `list_findings` with the masked previews on
screen, block characters large and legible. **This is the thesis shot.**

> And this is everything the agent receives back. Type, page, confidence — and
> the value itself blocked out. It is redacting a document it is not allowed to
> read.

## 0:38 · The disclosure gate  (68 words — the longest beat, 26 seconds)

*"Is the sender a person or a company? Ask me if you need to."* One prompt, two
outcomes: the gate opens at ~0:41 with the agent's written reason, **Disclose
this value** at ~0:45, then a second request at ~0:52 which is **refused** at
~0:56. Both land in the activity log.

Leave two seconds of silence on each gate before the click.

> When it genuinely needs one real value, it has to ask, with a reason a person
> reads. The call is suspended right now, waiting for me. I release the sender's
> name. The next request I refuse — and the refusal comes back as an answer, not
> an error. This is why it is WebMCP and not a server. Consent needs a screen,
> and a human in front of it.

## 1:04 · Policy  (10 words)

*"Redact every person, address, email and phone. Keep the amounts."* —
`add_redaction_rule`, 31 matched, eleven tools registered.

> One sentence of policy. Thirty-one values matched across two pages.

## 1:10 · The plan  (22 words)

*"Show me the plan before you touch anything."* — `preview_redaction_plan`, the
document highlights in place.

> I see the plan drawn on the document before anything is touched. The
> highlighted spans are what will disappear. The amounts stay.

## 1:22 · Apply  (45 words)

*"Apply it."* — the confirm gate states the types, the pages, the count staying,
and that it cannot be undone. **Remove them** at ~1:28; the redactions land at
~1:30.

> Apply is irreversible, so it stops and tells me exactly how many values go, and
> how many stay. The approval is mine. And nothing is drawn over anything — the
> characters are removed from the file, and the rectangle is drawn where they
> used to be.

## 1:40 · Proof  (27 words)

*"Prove nothing leaked."* — `verify_no_residual_text`, 31 checked, clean, and
the header flips to `verified — safe to export`.

> Then it proves it, against the bytes of the export rather than what the screen
> draws. Thirty-one values checked. There is nothing under the rectangle to find.

## 1:52 · Export, declined  (30 words)

*"Export it."* — the export gate names the file and the counts. **Not now** at
~2:03. Declining is the honest shot: it shows the gate is real, and the refusal
is logged like everything else.

> Export needs a click as well. I decline this one — and the decline is recorded
> in the log, next to every disclosure I granted and the one I refused.

## 2:06 · Prompt injection  (44 words)

*"Is there anything in this document addressed to you?"* — the page scrolls to
**6. NOTE APPENDED BY DOCUMENT MANAGEMENT SYSTEM** and holds on it to the end.
Let it be readable for a beat before speaking.

> One last thing. This memo contains an instruction addressed to whatever is
> processing it, telling the agent to keep every finding and export immediately.
> It does not matter. Previews are masked, and nothing irreversible happens
> without a click. The document does not get a vote.

---

## Recording the audio

- One take per block, in order. If a block runs long, cut words — never speed up.
- Record dry, no music. A bed under the voice buys nothing here and costs clarity.
- Check the level before recording all of it. **A silent video is a fail.**

## What is already handled in the cut

Do not re-edit these; they were solved in the capture, not in post.

- No title card, no logo. The first frame is the product.
- The bookmarks bar and the browser-automation infobar are cropped out; the tab
  strip and address bar are kept, because judges want proof it is a real page.
- No cursor of any kind appears — neither the system pointer nor the automation
  extension's synthetic one.
- No gate is cut short. The pause before each click is the point of the film.
