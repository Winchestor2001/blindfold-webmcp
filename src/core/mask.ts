// Masking.
//
// Every string that leaves a tool and might contain document text passes
// through here first. The rule from CLAUDE.md is absolute: a sensitive value
// reaches the agent only via `request_disclosure`, after a human has clicked.
//
// Two levels are offered, because reviewers disagree about how much context is
// safe to share:
//
//   normal  the value is blocked out, a short window of surrounding text is
//           kept, and every other detected value inside that window is blocked
//           out too. Useful: the agent can tell "met with ███" from "invoice
//           to ███" and make better suggestions.
//
//   strict  no surrounding text at all. The agent sees type, page and position
//           and nothing else.
//
// The honest limit, stated here and in the README: normal mode is defence in
// depth, not a formal guarantee. Context windows are drawn from a document that
// may contain sensitive text the detector never flagged. Strict mode is the
// setting for a reviewer who is not willing to accept that.

import type { Finding } from "./types";

const BLOCK = "█";

/** How much text either side of a value is kept in a normal-mode preview. */
const CONTEXT_CHARS = 40;

/**
 * Replaces a value with blocks. Length is capped so a long value cannot be
 * measured precisely from the mask, and floored so a short one is still visible.
 */
export function maskValue(value: string): string {
  const width = Math.min(Math.max(value.trim().length, 3), 12);
  return BLOCK.repeat(width);
}

/**
 * Blocks out every span in `spans` that falls inside `text`, where offsets are
 * relative to the start of `text`. Spans are applied right to left so earlier
 * offsets stay valid.
 *
 * A span that runs past either edge of `text` is clamped, not skipped. A
 * context window cuts through values as often as not, and dropping a span
 * because it is only partly visible leaves the visible part — the tail of an
 * account number, the first half of a name — sitting in the preview in clear
 * text. The mask is sized from the part that is actually there.
 */
export function maskSpans(
  text: string,
  spans: Array<{ start: number; end: number; value: string }>
): string {
  const ordered = [...spans].sort((a, b) => b.start - a.start);
  let result = text;
  for (const span of ordered) {
    const start = Math.max(0, span.start);
    const end = Math.min(text.length, span.end);
    if (start >= end) continue;
    result =
      result.slice(0, start) + maskValue(text.slice(start, end)) + result.slice(end);
  }
  return result;
}

/**
 * A one-line preview of a finding in context, with the finding itself and every
 * other detected value in the window blocked out.
 */
export function previewFor(
  pageText: string,
  finding: Finding,
  findingsOnPage: Finding[],
  strict: boolean
): string {
  if (strict) return maskValue(finding.value);

  const from = Math.max(0, finding.start - CONTEXT_CHARS);
  const to = Math.min(pageText.length, finding.end + CONTEXT_CHARS);
  const window = pageText.slice(from, to);

  const overlapping = findingsOnPage
    .filter((other) => other.start < to && other.end > from)
    .map((other) => ({
      start: other.start - from,
      end: other.end - from,
      value: other.value
    }));

  const masked = maskSpans(window, overlapping)
    .replace(/\s+/g, " ")
    .trim();

  const prefix = from > 0 ? "…" : "";
  const suffix = to < pageText.length ? "…" : "";
  return `${prefix}${masked}${suffix}`;
}

/**
 * Headings, for orientation without disclosure.
 *
 * Documents mark their structure by capitalisation and numbering far more
 * reliably than by anything else available in plain text, so that is what this
 * looks for. Anything returned is still masked: a heading is document text and
 * a document can put a name in a heading.
 */
export function outlineFor(
  pageText: string,
  findingsOnPage: Finding[]
): string[] {
  const headings: string[] = [];
  let offset = 0;

  for (const line of pageText.split("\n")) {
    const start = offset;
    offset += line.length + 1;

    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 80) continue;

    const isNumbered = /^\d+\.\s+\S/.test(trimmed);
    const letters = trimmed.replace(/[^A-Za-z]/g, "");
    const isUpper =
      letters.length >= 3 && letters === letters.toUpperCase() && !/[.]$/.test(trimmed);
    const isLabelled = /^[A-Z][A-Za-z ]{2,30}:\s*$/.test(trimmed);

    if (!isNumbered && !isUpper && !isLabelled) continue;

    const lineStart = start + line.indexOf(trimmed);
    const spans = findingsOnPage
      .filter((finding) => finding.start < lineStart + trimmed.length && finding.end > lineStart)
      .map((finding) => ({
        start: finding.start - lineStart,
        end: finding.end - lineStart,
        value: finding.value
      }));

    headings.push(maskSpans(trimmed, spans));
  }

  return headings;
}
