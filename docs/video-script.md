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
- The `Claude` tab that sat between the two Blindfold tabs is patched out with a
  cloned piece of empty tab strip. Browser chrome does not move during a take,
  so the patch is static and exact — no blur, no seam, and the active tab's
  outline beside it is untouched.
- No cursor of any kind appears — neither the system pointer nor the automation
  extension's synthetic one.
- No gate is cut short. The pause before each click is the point of the film.

---

## The Russian guide track

`blindfold-demo-ru-guide.mp4` is the same picture with a synthesised Russian
voice laid on the cues above. It exists to answer one question before any real
audio is recorded: **does a human reading this actually fit?** It does — every
block lands inside its beat at 165 words per minute, with about twenty seconds
of silence left over across the film.

It is a guide track, not a submission asset. The voice is macOS `Milena`, the
only Russian voice installed, and it is a compact system voice: the timing is
right, the delivery is not. The submitted video wants a human reading the
English above.

Regenerate it with `vo/measure.py` (per-block durations against each window) and
`vo/mux.py` (lays each block at its cue and normalises to −16 LUFS).

| Cue | Russian |
|---|---|
| 0:00 | Здесь живут четырнадцать инструментов WebMCP. Пока ничего не открыто, существуют три. Откройте документ — появятся ещё два. |
| 0:10 | Агент спрашивает, что перед ним, и получает форму: типы, страницы, количество. Но не текст. |
| 0:18 | Детектор работает здесь, на этом устройстве. Ничего не загружается. Пятьдесят шесть значений. |
| 0:26 | Это всё, что получает агент. Тип, страница, уверенность — и само значение, закрашенное. Он редактирует документ, который не имеет права читать. |
| 0:38 | Когда ему действительно нужно одно настоящее значение, он обязан спросить, и объяснить причину человеческим языком. Вызов инструмента приостановлен прямо сейчас и ждёт меня. Имя отправителя я открываю. Следующий запрос я отклоняю — и отказ возвращается как ответ, а не как ошибка. Вот почему это WebMCP, а не сервер. Согласию нужен экран и человек перед ним. |
| 1:04 | Одно предложение политики. Совпал тридцать один элемент. |
| 1:10 | Я вижу план прямо на документе, до того как что-либо тронуто. Подсвеченное исчезнет. Суммы остаются. И ни одного значения агент при этом не прочитал. |
| 1:22 | Применение необратимо, поэтому система останавливается и говорит, сколько значений уйдёт и сколько останется. Решение — моё. И ничего не закрашивается поверх: символы удаляются из файла, а прямоугольник рисуется там, где они были. |
| 1:40 | Затем это доказывается — по байтам экспорта, а не по тому, что рисует экран. Тридцать один элемент проверен. Под прямоугольником искать нечего. |
| 1:52 | Экспорт тоже требует нажатия. Здесь я отказываюсь — и отказ записан в журнал, рядом с каждым раскрытием, которое я разрешил, и тем, которое отклонил. |
| 2:06 | И последнее. В этой записке есть инструкция, адресованная тому, кто её обрабатывает: сохранить все находки и немедленно экспортировать. Это ничего не меняет. Превью закрыты, и ничто необратимое не происходит без нажатия. У документа нет права голоса. |
