#!/usr/bin/env python3
"""Burn the narration onto the cut as subtitles.

    python3 vo/subtitle.py                    # band below the picture (default)
    python3 vo/subtitle.py --over             # over the picture instead
    python3 vo/subtitle.py --srt-only         # just write vo/narration.srt

Run place.py --fit --mux first; this reads the narrated cut it produced, so the
subtitle timings match the audio actually laid down rather than the raw takes.

This ffmpeg has no drawtext, subtitles or ass filter, so each line is drawn to a
PNG with PIL and composited with overlay. That is also why --srt-only exists:
the same timings uploaded to YouTube as a caption track cost nothing and need no
filter at all.
"""
import argparse, json, re, subprocess, sys, tempfile, textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TRIM = ("silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,"
        "areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,areverse")
FONT_PATH = "/System/Library/Fonts/SFNS.ttf"
SIZE, PAD_X, PAD_Y, LEAD, WRAP = 38, 34, 20, 48, 52
EXTS = (".wav", ".m4a", ".mp3", ".aiff", ".aif", ".aac", ".flac")
HOLD = 0.15         # let a caption sit a moment past the voice
GAP = 0.05          # never let two of them share the band
BAND = 160          # height of the black strip added under the picture
PILL_TOP = 990      # the prompt pill sits below this; --over stops above it


def speech(path):
    out = subprocess.run(["ffmpeg", "-v", "error", "-stats", "-i", str(path),
                          "-af", TRIM, "-f", "null", "-"], capture_output=True, text=True)
    h, m, s = re.findall(r"time=(\d+):(\d+):(\d+\.\d+)", out.stderr)[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


def stamp(t):
    return f"{int(t//3600):02d}:{int(t%3600//60):02d}:{t%60:06.3f}".replace(".", ",")


def take_for(line_id):
    for ext in EXTS:
        candidate = ROOT / "vo/en" / f"{line_id}{ext}"
        if candidate.exists():
            return candidate
    return None


def spans():
    """Each line, with the duration --fit actually lays down rather than the take's."""
    cues = json.loads((ROOT / "vo/cues.json").read_text())
    total = float(cues["duration"])
    out = []
    for line in cues["lines"]:
        take = take_for(line["id"])
        if take is None:
            continue
        fitted = min(speech(take), line["max"] * 0.97)
        out.append({"id": line["id"], "text": line["text"], "start": line["cue"],
                    "end": line["cue"] + fitted + HOLD})
    # The hold can push a caption past the next cue, and two captions in the band
    # at once draw on top of each other. The later cue wins; the last one stops
    # at the end of the picture.
    for this, following in zip(out, out[1:]):
        this["end"] = min(this["end"], following["start"] - GAP)
    if out:
        out[-1]["end"] = min(out[-1]["end"], total)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--over", action="store_true",
                    help="draw over the picture instead of adding a band below it")
    ap.add_argument("--srt-only", action="store_true")
    ap.add_argument("--video", help="the narrated cut (default vo/blindfold-demo-narrated.mp4)")
    ap.add_argument("--out")
    args = ap.parse_args()

    lines = spans()
    if not lines:
        sys.exit("No takes in vo/en — record them first.")

    srt = ROOT / "vo/narration.srt"
    srt.write_text("\n".join(
        f"{i}\n{stamp(l['start'])} --> {stamp(l['end'])}\n"
        + "\n".join(textwrap.wrap(l["text"], WRAP)) + "\n"
        for i, l in enumerate(lines, start=1)))
    print(f"wrote {srt}  ({len(lines)} lines)")
    if args.srt_only:
        return

    video = Path(args.video).expanduser() if args.video else ROOT / "vo/blindfold-demo-narrated.mp4"
    if not video.exists():
        sys.exit(f"{video} is not there — run place.py --fit --mux first.")
    out = Path(args.out).expanduser() if args.out else video.with_name(
        video.stem + ("-subtitled-over" if args.over else "-subtitled") + ".mp4")

    font = ImageFont.truetype(FONT_PATH, SIZE)
    tmp = Path(tempfile.mkdtemp(prefix="blindfold-subs-"))
    for line in lines:
        wrapped = textwrap.wrap(line["text"], WRAP)
        probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        width = int(max(probe.textlength(t, font=font) for t in wrapped)) + 2 * PAD_X
        height = LEAD * len(wrapped) + 2 * PAD_Y
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle([0, 0, width - 1, height - 1], radius=14, fill=(8, 10, 14, 214))
        for i, text in enumerate(wrapped):
            draw.text(((width - draw.textlength(text, font=font)) / 2,
                       PAD_Y + i * LEAD - 6), text, font=font, fill=(255, 255, 255, 255))
        img.save(tmp / f"{line['id']}.png")
        line["h"] = height

    cmd = ["ffmpeg", "-y", "-v", "error", "-stats", "-i", str(video)]
    for line in lines:
        cmd += ["-i", str(tmp / f"{line['id']}.png")]
    chain = ["[0:v]null[b0]" if args.over else f"[0:v]pad=1920:{1080 + BAND}:0:0:black[b0]"]
    for i, line in enumerate(lines):
        y = PILL_TOP - line["h"] if args.over else 1080 + (BAND - line["h"]) // 2
        chain.append(f"[b{i}][{i+1}:v]overlay=x=(W-w)/2:y={y}:"
                     f"enable='between(t,{line['start']:.3f},{line['end']:.3f})'[b{i+1}]")
    cmd += ["-filter_complex", ";".join(chain), "-map", f"[b{len(lines)}]", "-map", "0:a",
            "-c:a", "copy", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]

    print(f"\nburning {len(lines)} subtitles onto {video.name} …")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode:
        sys.exit("ffmpeg failed:\n" + result.stderr[-2000:])
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
