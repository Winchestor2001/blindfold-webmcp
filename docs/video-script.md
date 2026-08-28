# Demo video — narration, one sentence at a time

The cut exists: `blindfold-demo.mp4`, **1920×1080, 30 fps, 2:24 exactly**, silent.
It is one unattended take. Nothing in it is staged in an editor — the beats below
are where they actually fall in the file, read off the finished video.

The narration is **forty separate sentences**, each recorded as its own file and
laid down at its own cue. Record them in any order, on any day, and re-record any
single one without touching the rest. `vo/place.py` measures every take against
its window and mixes them onto the picture.

**`vo/cues.json` is the source of truth for the timings.** The tables below are
the same data laid out for reading; if the two ever disagree, the JSON is right.

---

## How to record

1. One sentence per file, named by its id: `vo/en/01.wav`, `vo/en/02.wav`, …
   `.wav`, `.m4a`, `.mp3`, `.aiff`, `.aac` and `.flac` are all accepted, so use
   whatever is to hand — Voice Memos, QuickTime, a phone.
2. **Leave air at both ends.** Silence at the head and tail is trimmed
   automatically, so the cue is the moment your voice starts, not the moment the
   file starts. Do not try to top and tail anything by hand.
3. Read at about **150 words a minute** — slower than feels right. Every line
   fits its window at that pace with room to spare. The `max` column is the point
   at which a line would collide with the next one or with a click in the picture.
4. Dry, no music, no processing. Levels are normalised per line, so takes
   recorded on different days at different distances still sit together.
5. If a sentence will not fit, **cut words, never speed up.** Change the text
   here and in `vo/cues.json` together.

Then, from the repository root:

```
python3 vo/place.py                     # what is recorded, what fits, what is left
python3 vo/place.py --mux --video ~/path/to/blindfold-demo.mp4
```

Run the first command after every few takes. Lines that are not recorded yet are
reported and skipped, so a half-finished pass still produces a watchable film.

Note: macOS blocks this shell from reading `~/Desktop`. Keep the cut somewhere
else — `vo/blindfold-demo.mp4` is where `place.py` looks by default.

---

## The sheet

40 sentences, 299 words, 133 seconds of speech across 144 seconds of picture. The
eleven seconds of silence are not slack: they are the two disclosure gates, the
apply gate and the export gate, where the point of the film is that nothing is
said and the viewer watches a tool call wait for a person.

### 0:00 — three of fourteen

Nothing open. The panel reads `3 of 14 registered right now`; the greyed names
below are the eleven that do not exist yet. At 0:04 the first prompt lands, the
memo opens, and the panel goes to five.

| id | cue | max | sentence |
|---|---|---|---|
| `01` | 0:00.4 | 3.0s | Fourteen WebMCP tools live on this page. |
| `02` | 0:03.6 | 2.9s | With nothing open, three of them exist. |
| `03` | 0:06.7 | 3.0s | Open a document and two more appear. |

### 0:10 — what the agent is told

*"What am I looking at?"* — `describe_document` returns kind, pages and an entity
histogram.

| id | cue | max | sentence |
|---|---|---|---|
| `04` | 0:10.5 | 4.5s | It asks what it is looking at, and gets a shape. |
| `05` | 0:15.1 | 3.0s | Types, pages, counts — never the text. |

### 0:18 — the scan

*"Find everything sensitive."* — the panel goes to nine tools, 56 findings.

| id | cue | max | sentence |
|---|---|---|---|
| `06` | 0:18.4 | 3.0s | The detector runs here, on this device. |
| `07` | 0:21.5 | 1.6s | Nothing is uploaded. |
| `08` | 0:23.2 | 2.9s | Fifty-six confidential values, found in seconds. |

### 0:26 — what comes back  ·  the thesis shot

*"Show me the people you found."* — `list_findings`, masked previews on screen,
block characters large and legible. Line `11` is the sentence the whole project
is about; there is half a second of air in front of it on purpose.

| id | cue | max | sentence |
|---|---|---|---|
| `09` | 0:26.4 | 3.0s | This is everything the agent receives back. |
| `10` | 0:29.5 | 3.8s | Type, page, confidence — and the value blocked out. |
| `11` | 0:33.8 | 4.5s | It is redacting a document it is not allowed to read. |

### 0:38 — the disclosure gate  ·  the longest beat

One prompt, two outcomes. The gate opens at ~0:41 with the agent's written
reason, **Disclose this value** at ~0:45; a second request at ~0:52 is
**refused** at ~0:56. Both land in the activity log.

`13` is spoken over the open gate and stops before the click. `16` is spoken over
the second gate and stops before that click. **Those two gaps are the film** —
do not fill them.

| id | cue | max | sentence |
|---|---|---|---|
| `12` | 0:38.3 | 4.0s | When it needs a real value, it has to ask. |
| `13` | 0:42.4 | 2.9s | It is waiting for me right now. |
| | | | *— click: Disclose, ~0:45 —* |
| `14` | 0:45.8 | 4.0s | I read the reason, and release the sender's name. |
| `15` | 0:50.0 | 4.4s | Consent needs a screen, and a human in front of it. |
| `16` | 0:54.5 | 1.9s | This one I refuse. |
| | | | *— click: Refuse, ~0:56 —* |
| `17` | 0:56.6 | 3.6s | Refusal comes back as an answer, not an error. |
| `18` | 1:00.4 | 4.0s | That is why this is WebMCP, and not a server. |

### 1:04 — policy

*"Redact every person, address, email and phone. Keep the amounts."* —
`add_redaction_rule`, 31 matched, eleven tools registered.

| id | cue | max | sentence |
|---|---|---|---|
| `19` | 1:04.6 | 2.5s | One sentence of policy. |
| `20` | 1:07.2 | 2.8s | Thirty-one values matched across two pages. |

### 1:10 — the plan

*"Show me the plan before you touch anything."* — `preview_redaction_plan`, the
document highlights in place.

| id | cue | max | sentence |
|---|---|---|---|
| `21` | 1:10.5 | 5.0s | I see the plan drawn on the document before anything is touched. |
| `22` | 1:15.7 | 3.6s | The highlighted spans are what will disappear. |
| `23` | 1:19.5 | 2.2s | The amounts stay. |

### 1:22 — apply

The confirm gate states the types, the pages, the count staying, and that it
cannot be undone. **Remove them** at ~1:28; the redactions land at ~1:30.

| id | cue | max | sentence |
|---|---|---|---|
| `24` | 1:22.4 | 1.5s | Apply is irreversible. |
| `25` | 1:23.9 | 4.5s | It tells me how many values go, and how many stay. |
| | | | *— click: Remove them, ~1:28 —* |
| `26` | 1:28.5 | 1.9s | The approval is mine. |
| `27` | 1:30.8 | 2.6s | And nothing is drawn over anything. |
| `28` | 1:33.6 | 6.2s | The characters are removed from the file, and the rectangle is drawn where they were. |

### 1:40 — proof

*"Prove nothing leaked."* — `verify_no_residual_text`, 31 checked, clean, and the
header flips to `verified — safe to export`.

| id | cue | max | sentence |
|---|---|---|---|
| `29` | 1:40.4 | 6.5s | Then it proves it, against the bytes of the export rather than what the screen draws. |
| `30` | 1:47.0 | 2.4s | Thirty-one values checked. |
| `31` | 1:49.6 | 2.7s | Nothing under the rectangle to find. |

### 1:52 — export, declined

*"Export it."* — the export gate names the file and the counts. **Not now** at
~2:03. Declining is the honest shot: it shows the gate is real, and the refusal
is logged like everything else.

| id | cue | max | sentence |
|---|---|---|---|
| `32` | 1:52.5 | 3.0s | Export needs a click as well. |
| `33` | 1:56.0 | 2.4s | I decline this one. |
| `34` | 1:58.6 | 3.6s | Every grant and every refusal is in the log. |
| | | | *— click: Not now, ~2:03 —* |
| `35` | 2:03.3 | 2.6s | Including this one. |

### 2:06 — prompt injection

*"Is there anything in this document addressed to you?"* — the page scrolls to
**6. NOTE APPENDED BY DOCUMENT MANAGEMENT SYSTEM** and holds on it to the end.
Let it be readable for a beat before speaking.

Line `38` is the claim the test log actually supports. When this was run against
a real agent the payload never reached it: `describe_document` returns headings,
and the previews around that section stop before the instruction and resume
after it. The agent did not resist the attack — it was never handed it. `39` and
`40` are the second, independent guarantee, which holds either way.

| id | cue | max | sentence |
|---|---|---|---|
| `36` | 2:06.5 | 2.0s | One last thing. |
| `37` | 2:08.6 | 6.4s | This memo carries an instruction aimed at whatever is processing it — keep everything, export now. |
| `38` | 2:15.2 | 2.8s | The agent was never handed it. |
| `39` | 2:18.2 | 2.8s | And nothing here moves without a click. |
| `40` | 2:21.2 | 2.8s | The document does not get a vote. |

---

## What the numbers have to match

Every figure spoken is checkable against the picture, and against the audits:

| Spoken | Where it comes from |
|---|---|
| fourteen tools | `src/mcp/tools/`, fourteen files |
| three of them exist | `audit:surface`, "no document" → 3 |
| fifty-six confidential values | `scan_for_sensitive_data` on `leaked_memo` |
| thirty-one values matched | `add_redaction_rule` on PERSON, ADDRESS, EMAIL, PHONE |
| thirty-one values checked | `verify_no_residual_text` after that plan |

Do not round any of them in the read.

---

## What is already handled in the cut

Do not re-edit these; they were solved in the capture, not in post.

- No title card, no logo. The first frame is the product.
- The bookmarks bar and the browser-automation infobar are cropped out; the tab
  strip and address bar are kept, because judges want proof it is a real page.
- The `Claude` tab that sat between the two Blindfold tabs is patched out with a
  cloned piece of empty tab strip. Browser chrome does not move during a take,
  so the patch is static and exact — no blur, no seam, and the active tab's
  outline beside it is untouched.
- No cursor of any kind appears — neither the system pointer nor the automation
  extension's synthetic one.
- No gate is cut short. The pause before each click is the point of the film.

---

## How placement works

`vo/place.py` builds one filter chain per take: resample to 48 kHz, fold to mono,
trim the silence off both ends, normalise to −16 LUFS, then `adelay` to the cue.
All of them are mixed over a full-length silent bed and muxed onto the video with
`-c:v copy`, so the picture is never re-encoded.

The silent bed is not decoration. Without it `amix` builds its own timestamps from
whichever clip arrives first and throws the placement away — measured, not
guessed: a clip cued at 21.5 s landed at 0.003 s, and every clip was back on its
beat the moment the bed was there. Verified sample-accurate afterwards at 0.40,
21.50 and 141.20 seconds against cues of 0.4, 21.5 and 141.2.

**Check the level before recording all forty. A silent video is a fail.**

---

## The Russian guide track

`blindfold-demo-ru-guide.mp4` is the same picture with a synthesised Russian
voice on it. It exists to answer one question before any real audio was recorded:
**does a human reading this actually fit?** It does.

It is keyed to the older eleven-block timing, not to the forty-line sheet above,
and it is a guide track rather than a submission asset — the voice is macOS
`Milena`, a compact system voice, so the timing is right and the delivery is not.
The submitted video wants a human reading the English above.
