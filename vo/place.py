#!/usr/bin/env python3
"""Place one-sentence English voice recordings onto the demo cut.

    python3 vo/place.py                 # measure what has been recorded so far
    python3 vo/place.py --mux           # build the narrated video
    python3 vo/place.py --mux --video ~/somewhere/blindfold-demo.mp4

Every line in vo/cues.json is one recording, named by its id, in vo/en/.
Any of .wav .m4a .mp3 .aiff .aac .flac is accepted, so record with whatever
is to hand. Lines that have not been recorded yet are simply reported and
skipped, so this can be run after every few takes rather than only at the end.

A line that runs past its `max` collides with the next line or with a click in
the picture. The report says by how much, so a single sentence can be re-read
without touching the rest.

Silence at the head and tail of a take is trimmed automatically, so the cue is
the moment the voice starts rather than the moment the file starts. Leave as much
air around each sentence as you like; it never reaches the film, and the
durations reported below are of the speech, not of the file.

Each clip is loudness-normalised on its own before it is laid down. Recording
sentence by sentence means the level drifts between takes, and one loud line in
a quiet film is worse than any of them being slightly off.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUES = ROOT / "vo" / "cues.json"
AUDIO_DIR = ROOT / "vo" / "en"
EXTS = (".wav", ".m4a", ".mp3", ".aiff", ".aif", ".aac", ".flac")

# Trim silence from both ends. The second pass is the first one run backwards,
# which is the only way ffmpeg will take silence off the tail.
TRIM = (
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,"
    "areverse,"
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,"
    "areverse"
)


def die(message: str) -> "None":
    print(f"\n{message}", file=sys.stderr)
    raise SystemExit(1)


def duration_of(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        die(f"ffprobe could not read {path}:\n{out.stderr.strip()}")
    return float(out.stdout.strip())


def speech_duration(path: Path) -> float:
    """How long the take is once the silence at each end is taken off."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-stats", "-i", str(path), "-af", TRIM, "-f", "null", "-"],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        die(f"ffmpeg could not measure {path}:\n{out.stderr.strip()}")
    stamps = re.findall(r"time=(\d+):(\d+):(\d+\.\d+)", out.stderr)
    if not stamps:
        return duration_of(path)
    hours, minutes, seconds = stamps[-1]
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def take_for(line_id: str) -> "Path | None":
    for ext in EXTS:
        candidate = AUDIO_DIR / f"{line_id}{ext}"
        if candidate.exists():
            return candidate
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mux", action="store_true", help="build the narrated video")
    parser.add_argument("--video", help="the silent cut (defaults to the one named in cues.json)")
    parser.add_argument("--out", help="output file (defaults to <video>-narrated.mp4)")
    args = parser.parse_args()

    cues = json.loads(CUES.read_text())
    lines = cues["lines"]
    total = float(cues["duration"])

    print(f"{len(lines)} lines, {total:.1f} s of picture, recordings in {AUDIO_DIR}\n")

    takes = []
    missing = []
    over = []
    for line in lines:
        path = take_for(line["id"])
        if path is None:
            missing.append(line)
            print(f"  {line['id']}  {'—':>6}          not recorded   {line['text'][:52]}")
            continue
        seconds = speech_duration(path)
        slack = line["max"] - seconds
        mark = "ok " if slack >= 0 else "OVER"
        if slack < 0:
            over.append((line, seconds))
        print(
            f"  {line['id']}  {seconds:5.2f}s  cue {line['cue']:6.1f}  "
            f"max {line['max']:.1f}  {mark} {slack:+5.2f}   {line['text'][:52]}"
        )
        takes.append((line, path))

    print()
    if missing:
        print(f"{len(missing)} of {len(lines)} still to record: "
              + ", ".join(line["id"] for line in missing))
    if over:
        print(f"\n{len(over)} read long and will collide with what follows. Re-read these:")
        for line, seconds in over:
            print(f"  {line['id']}  {seconds:.2f}s, needs to be under {line['max']:.1f}s"
                  f"  —  \"{line['text']}\"")
    if not missing and not over:
        print("Every line recorded and every line fits.")

    if not args.mux:
        return
    if not takes:
        die("Nothing recorded yet — nothing to mux.")

    video = Path(args.video).expanduser() if args.video else ROOT / cues["video"]
    if not video.exists():
        die(f"The silent cut is not at {video}.\n"
            f"Copy it there, or pass --video with its path. macOS blocks the\n"
            f"Desktop from this shell, so a file left there cannot be read.")

    out = Path(args.out).expanduser() if args.out else video.with_name(video.stem + "-narrated.mp4")

    # A continuous silent bed under everything. Without it amix builds its own
    # timestamps from whichever clip arrives first and throws the adelay
    # placement away — measured, not guessed: a clip cued at 21.5 s landed at
    # 0.003 s, and every clip was back on its beat the moment the bed was there.
    cmd = ["ffmpeg", "-y", "-i", str(video),
           "-f", "lavfi", "-t", str(total), "-i", "anullsrc=r=48000:cl=mono"]
    for _, path in takes:
        cmd += ["-i", str(path)]

    filters = []
    labels = ["[1:a]"]
    for index, (line, _) in enumerate(takes, start=2):
        delay = int(round(line["cue"] * 1000))
        label = f"a{index}"
        filters.append(
            f"[{index}:a]aresample=48000,pan=mono|c0=c0,"
            f"{TRIM},"
            f"loudnorm=I=-16:TP=-1.5:LRA=11,"
            f"adelay={delay}:all=1[{label}]"
        )
        labels.append(f"[{label}]")
    filters.append(
        "".join(labels)
        + f"amix=inputs={len(takes) + 1}:normalize=0:dropout_transition=0,"
        + f"apad,atrim=0:{total},asetpts=N/SR/TB[out]"
    )

    cmd += [
        "-filter_complex", ";".join(filters),
        "-map", "0:v", "-map", "[out]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        str(out),
    ]

    print(f"\nmuxing {len(takes)} lines onto {video.name} …")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        die("ffmpeg failed:\n" + result.stderr[-3000:])
    print(f"wrote {out}  ({duration_of(out):.2f} s)")
    if missing:
        print(f"Note: {len(missing)} lines were silent — "
              + ", ".join(line["id"] for line in missing))


if __name__ == "__main__":
    main()
