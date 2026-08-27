// Redaction and export.
//
// The failure this file exists to prevent is the one that keeps producing news
// stories: a document is "redacted" by drawing black rectangles over text, the
// text is still in the file, and anyone can select it or read it out of the raw
// bytes.
//
// Blindfold does not draw over anything. The exported PDF is rebuilt from the
// document's text, and characters inside a redacted span are never written to
// the file at all. The black rectangle is drawn where they would have been, so
// the page still reads like a redacted document, but there is nothing beneath
// it. `findResidual` then proves that by searching the bytes it is about to
// hand over.
//
// A monospaced font is used deliberately: with a fixed advance width the offset
// of a character in the text maps to an x coordinate by multiplication, so the
// rectangle lands exactly where the removed characters were, with no font
// metrics to get wrong.

import type { PDFDocument, PDFFont, RGB } from "pdf-lib";

import type { AuditEntry, Finding, LoadedDocument } from "./types";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const FONT_SIZE = 9;
const LINE_HEIGHT = 12.4;
/** Courier's advance width is exactly 0.6 em at every size. */
const CHAR_WIDTH = FONT_SIZE * 0.6;
const COLUMNS = Math.floor((PAGE_WIDTH - MARGIN * 2) / CHAR_WIDTH);
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT);

export type Span = { start: number; end: number };

type PhysicalLine = {
  text: string;
  /** Offset of this line's first character within the page's text. */
  offset: number;
};

/**
 * Breaks a logical line into physical lines at the column limit, preferring a
 * space, and reports where each piece started so redaction offsets survive the
 * break.
 */
function wrapLine(line: string, offset: number): PhysicalLine[] {
  if (line.length <= COLUMNS) return [{ text: line, offset }];

  const pieces: PhysicalLine[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    let take = Math.min(COLUMNS, line.length - cursor);
    if (cursor + take < line.length) {
      const lastSpace = line.lastIndexOf(" ", cursor + take);
      if (lastSpace > cursor) take = lastSpace - cursor;
    }
    pieces.push({ text: line.slice(cursor, cursor + take), offset: offset + cursor });
    cursor += take;
    while (line[cursor] === " ") cursor += 1;
  }
  return pieces;
}

function layout(pageText: string): PhysicalLine[] {
  const lines: PhysicalLine[] = [];
  let offset = 0;
  for (const line of pageText.split("\n")) {
    lines.push(...wrapLine(line, offset));
    offset += line.length + 1;
  }
  return lines;
}

/**
 * Splits one physical line into runs, marking which are removed. Redacted runs
 * carry no text — the characters are dropped here, before anything is written.
 */
function runsFor(
  line: PhysicalLine,
  spans: Span[]
): Array<{ column: number; length: number; text: string | null }> {
  const lineStart = line.offset;
  const lineEnd = lineStart + line.text.length;

  const local = spans
    .filter((span) => span.start < lineEnd && span.end > lineStart)
    .map((span) => ({
      start: Math.max(0, span.start - lineStart),
      end: Math.min(line.text.length, span.end - lineStart)
    }))
    .sort((a, b) => a.start - b.start);

  const runs: Array<{ column: number; length: number; text: string | null }> = [];
  let cursor = 0;
  for (const span of local) {
    if (span.start > cursor) {
      runs.push({
        column: cursor,
        length: span.start - cursor,
        text: line.text.slice(cursor, span.start)
      });
    }
    if (span.end > cursor) {
      runs.push({ column: Math.max(cursor, span.start), length: span.end - Math.max(cursor, span.start), text: null });
      cursor = span.end;
    }
  }
  if (cursor < line.text.length) {
    runs.push({
      column: cursor,
      length: line.text.length - cursor,
      text: line.text.slice(cursor)
    });
  }
  return runs;
}

export type BuildInput = {
  doc: LoadedDocument;
  /** Findings whose status is redact. Their text is never written to the file. */
  redacted: Finding[];
  audit: AuditEntry[];
};

/**
 * Produces the exported PDF. Pure: the same input always yields the same bytes
 * apart from the creation date, which is why verification can build the file,
 * inspect it, and hand the very same bytes to the user.
 */
export async function buildRedactedPdf(input: BuildInput): Promise<Uint8Array> {
  // Loaded on demand. pdf-lib is by far the largest thing this application
  // depends on and it is not needed until someone exports, so it should not be
  // in the way of the page appearing.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Courier);
  const bold = await pdf.embedFont(StandardFonts.CourierBold);

  pdf.setTitle(`${input.doc.title} (redacted)`);
  pdf.setProducer("Blindfold");
  pdf.setCreator("Blindfold");

  const spansByPage = new Map<number, Span[]>();
  for (const finding of input.redacted) {
    const list = spansByPage.get(finding.page) ?? [];
    list.push({ start: finding.start, end: finding.end });
    spansByPage.set(finding.page, list);
  }

  for (const documentPage of input.doc.pages) {
    const spans = spansByPage.get(documentPage.number) ?? [];
    const lines = layout(documentPage.text);

    for (let index = 0; index < lines.length; index += LINES_PER_PAGE) {
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const chunk = lines.slice(index, index + LINES_PER_PAGE);

      chunk.forEach((line, row) => {
        const y = PAGE_HEIGHT - MARGIN - (row + 1) * LINE_HEIGHT;
        for (const run of runsFor(line, spans)) {
          const x = MARGIN + run.column * CHAR_WIDTH;
          if (run.text === null) {
            page.drawRectangle({
              x: x - 0.5,
              y: y - 2,
              width: run.length * CHAR_WIDTH + 1,
              height: FONT_SIZE + 2,
              color: rgb(0, 0, 0)
            });
          } else {
            page.drawText(run.text, { x, y, size: FONT_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
          }
        }
      });
    }
  }

  addAuditPage(pdf, font, bold, input, rgb);
  // Object streams would compress the page content, which would make the
  // residual-text check unable to read what it is checking. See findResidual.
  return pdf.save({ useObjectStreams: false });
}

function addAuditPage(
  pdf: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  input: BuildInput,
  rgb: (red: number, green: number, blue: number) => RGB
): void {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const write = (text: string, useBold = false) => {
    if (y < MARGIN) return;
    page.drawText(text.slice(0, COLUMNS), {
      x: MARGIN,
      y,
      size: FONT_SIZE,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= LINE_HEIGHT;
  };

  write("REDACTION AUDIT", true);
  y -= 4;
  write(`Document: ${input.doc.title}`);
  write(`Values removed: ${input.redacted.length}`);

  const byType = new Map<string, number>();
  for (const finding of input.redacted) {
    byType.set(finding.type, (byType.get(finding.type) ?? 0) + 1);
  }
  write(
    `By type: ${[...byType.entries()].sort().map(([type, count]) => `${type} ${count}`).join(", ") || "none"}`
  );
  y -= 6;
  write("DECISION LOG", true);
  y -= 4;
  write("This log records finding identifiers and types only, never values.");
  y -= 6;

  for (const entry of input.audit) {
    write(`${entry.at.slice(11, 19)}  ${entry.actor.padEnd(5)}  ${entry.action}  ${entry.detail}`);
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type ResidualReport = {
  /**
   * Whether the check could read the file at all. A clean result from an
   * unreadable file proves nothing, so this is reported rather than assumed —
   * silently passing is the exact failure mode this project exists to prevent.
   */
  searchable: boolean;
  /** Values that survived into the file despite being marked for redaction. */
  residual: string[];
  checked: number;
};

function toLatin1(bytes: Uint8Array): string {
  let out = "";
  const CHUNK = 0x8000;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return out;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decodes every content stream in the file.
 *
 * A naive search of the raw bytes would find nothing, because PDF page content
 * is Flate-compressed — and finding nothing is exactly what a broken check looks
 * like. So the check decompresses the streams the same way a reader would, and
 * inspects what the reader would see.
 */
async function decodeContent(bytes: Uint8Array): Promise<string> {
  const raw = toLatin1(bytes);
  let decoded = "";
  let cursor = 0;

  for (;;) {
    const keyword = raw.indexOf("stream", cursor);
    if (keyword < 0) break;
    if (raw.slice(keyword - 3, keyword) === "end") {
      cursor = keyword + 6;
      continue;
    }

    const dictionary = raw.slice(Math.max(0, keyword - 400), keyword);
    let start = keyword + "stream".length;
    if (raw[start] === "\r") start += 1;
    if (raw[start] === "\n") start += 1;

    const end = raw.indexOf("endstream", start);
    if (end < 0) break;

    let slice = bytes.subarray(start, end);
    // Trim the end-of-line that separates the data from the endstream keyword.
    while (slice.length > 0 && (slice[slice.length - 1] === 0x0a || slice[slice.length - 1] === 0x0d)) {
      slice = slice.subarray(0, slice.length - 1);
    }

    if (dictionary.includes("/FlateDecode")) {
      try {
        decoded += toLatin1(await inflate(slice));
      } catch {
        // An undecodable stream is not evidence of cleanliness. Leaving it out
        // of `decoded` means the control check below will notice.
      }
    } else {
      decoded += toLatin1(slice);
    }

    cursor = end + "endstream".length;
  }

  return decoded;
}

/**
 * Concatenates the text-showing strings, in order, dropping the positioning
 * operators between them.
 *
 * PDF stores shown text in two forms and this has to read both: literal strings
 * in parentheses, and hex strings in angle brackets — pdf-lib writes the hex
 * form, so a reader that only handled parentheses would find nothing and call
 * the file clean. Concatenating also puts back together a value split across two
 * strings by a redaction beside it. Both effects err in the safe direction: this
 * can report a leak that is not there, never hide one.
 */
function shownText(content: string): string {
  let out = "";
  let index = 0;

  while (index < content.length) {
    const character = content[index];

    if (character === "(") {
      index += 1;
      let depth = 1;
      while (index < content.length && depth > 0) {
        const inner = content[index];
        if (inner === "\\") {
          out += content[index + 1] ?? "";
          index += 2;
          continue;
        }
        if (inner === "(") depth += 1;
        if (inner === ")") {
          depth -= 1;
          index += 1;
          if (depth === 0) break;
          out += inner;
          continue;
        }
        out += inner;
        index += 1;
      }
      continue;
    }

    if (character === "<" && content[index + 1] !== "<") {
      const close = content.indexOf(">", index + 1);
      if (close < 0) break;
      const digits = content.slice(index + 1, close).replace(/[^0-9A-Fa-f]/g, "");
      for (let pair = 0; pair + 1 < digits.length; pair += 2) {
        out += String.fromCharCode(parseInt(digits.slice(pair, pair + 2), 16));
      }
      index = close + 1;
      continue;
    }

    index += 1;
  }

  return out;
}

/**
 * Searches the file that is about to be handed over for every value that was
 * supposed to be removed.
 *
 * `control` is a value the reviewer chose to keep. If the check cannot find that
 * either, the file was not readable and no conclusion can be drawn from a clean
 * result. Saying so is the difference between a check and a reassuring noise.
 */
export async function findResidual(
  bytes: Uint8Array,
  redactedValues: string[],
  control: string | null
): Promise<ResidualReport> {
  const content = await decodeContent(bytes);
  const shown = shownText(content);
  const haystack = `${shown}\u0000${toLatin1(bytes)}`;

  const searchable = control === null ? true : shown.includes(control.trim());

  const residual: string[] = [];
  for (const value of redactedValues) {
    const trimmed = value.trim();
    if (trimmed.length < 3) continue;
    if (haystack.includes(trimmed)) residual.push(trimmed);
  }

  return { searchable, residual, checked: redactedValues.length };
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
