#!/usr/bin/env python3
"""Verify the recorded provenance of each mirrored source.

Two modes:

  offline (default)  — validate every `sources/*/.provenance`: well-formed,
                       required fields present, SHA well-formed, file counts
                       match what is actually on disk.

  --online           — additionally query each upstream's current default-branch
                       HEAD and report drift against the recorded commit. Needs
                       network; used by the scheduled CI job.

Drift is reported, not failed, in `--online` mode unless --fail-on-drift is
passed. A mirror being behind upstream is a fact to surface on a known date, not
an error in this repo.

Usage:  python3 scripts/check_provenance.py [--online] [--fail-on-drift]
Exit:   0 clean, 1 on a malformed or inconsistent record.
"""
from __future__ import annotations
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
MIRROR_REQUIRED = ("name", "upstream", "commit", "commit_date", "fetched", "files_mirrored")


def count_files(d: Path) -> int:
    return sum(1 for p in d.rglob("*") if p.is_file() and p.name != ".provenance")


def upstream_head(url: str, branch: str) -> str | None:
    r = subprocess.run(
        ["git", "ls-remote", url, f"refs/heads/{branch}"],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0 or not r.stdout.strip():
        return None
    return r.stdout.split()[0]


def main() -> int:
    online = "--online" in sys.argv
    fail_on_drift = "--fail-on-drift" in sys.argv
    errors: list[str] = []
    drifted: list[str] = []

    records = sorted(ROOT.glob("sources/*/.provenance"))
    if not records:
        print("no .provenance records found")
        return 1

    for rec_path in records:
        src = rec_path.parent
        rel = str(src.relative_to(ROOT))
        try:
            rec = json.loads(rec_path.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{rel}/.provenance: invalid JSON — {e}")
            continue

        # Originally-authored directories have no upstream to pin.
        if rec.get("kind") == "original":
            print(f"{rel:<24} original content — no upstream to pin")
            continue

        for field in MIRROR_REQUIRED:
            if not rec.get(field):
                errors.append(f"{rel}/.provenance: missing `{field}`")

        sha = rec.get("commit", "")
        if not SHA_RE.match(sha):
            errors.append(f"{rel}/.provenance: `commit` is not a full 40-char SHA")

        on_disk = count_files(src)
        recorded = rec.get("files_mirrored")
        drift_note = ""
        if recorded is not None and on_disk != recorded:
            errors.append(
                f"{rel}/.provenance: files_mirrored={recorded} but {on_disk} files on disk"
            )

        if online:
            head = upstream_head(rec["upstream"], rec.get("default_branch", "main"))
            if head is None:
                drift_note = "  [upstream unreachable]"
            elif head != sha:
                drifted.append(f"{rel}: recorded {sha[:12]} -> upstream now {head[:12]}")
                drift_note = f"  [DRIFT -> {head[:12]}]"
            else:
                drift_note = "  [current]"

        print(f"{rel:<24} {sha[:12]}  {rec.get('commit_date')}  {on_disk} files{drift_note}")

    if drifted:
        print(f"\n{len(drifted)} source(s) behind upstream:")
        for d in drifted:
            print(f"  {d}")
        print("\nThis is informational. Re-mirror deliberately, then update .provenance")
        print("and ATTRIBUTIONS.md together.")

    if errors:
        print(f"\n{len(errors)} error(s):")
        for e in errors:
            print(f"  {e}")
        return 1

    if drifted and fail_on_drift:
        return 1

    print("\nprovenance records consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
