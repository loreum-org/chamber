#!/usr/bin/env python3
"""Assert every repo-relative path referenced in the docs exists on disk.

The library indexes are hand-maintained across four files and ~20 sections, so
a moved or renamed skill silently rots them. This is the cheap permanent guard.

Usage:  python3 scripts/check_links.py
Exit:   0 clean, 1 on any broken reference.
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Docs whose references must resolve. Skill bodies are prose and may name
# illustrative paths that do not exist, so they are not scanned.
DOCS = [
    "README.md",
    "ATTRIBUTIONS.md",
    "CORRELATIONS.md",
    "LICENSE",
    *(str(p.relative_to(ROOT)) for p in sorted((ROOT / "library").glob("*.md"))),
    "sources/omega/README.md",
    "sources/omega/ATTRIBUTION.md",
]

# `backtick/quoted/path.md`  and  [text](relative/path.md)
BACKTICK = re.compile(r"`((?:sources|library|scripts)/[^`\s]+)`")
MDLINK = re.compile(r"\[[^\]]*\]\(([^)#]+?)\)")

# Placeholders and globs are documentation, not assertions.
PLACEHOLDER = re.compile(r"[<>*]|\.\.\.|\{")


def is_checkable(target: str) -> bool:
    if not target or PLACEHOLDER.search(target):
        return False
    if target.startswith(("http://", "https://", "mailto:", "#")):
        return False
    return True


def main() -> int:
    broken: list[tuple[str, int, str]] = []
    checked = 0

    for doc in DOCS:
        path = ROOT / doc
        if not path.exists():
            broken.append((doc, 0, "<the doc itself is missing>"))
            continue

        for lineno, line in enumerate(path.read_text().splitlines(), 1):
            targets = [(m.group(1), True) for m in BACKTICK.finditer(line)]
            targets += [(m.group(1), False) for m in MDLINK.finditer(line)]

            for target, from_root in targets:
                if not is_checkable(target):
                    continue
                # Backticked paths are repo-root-relative by convention;
                # markdown links are relative to the file they appear in.
                base = ROOT if from_root else path.parent
                resolved = (base / target).resolve()
                checked += 1
                if not resolved.exists():
                    broken.append((doc, lineno, target))

    print(f"checked {checked} path references across {len(DOCS)} docs")
    if broken:
        print(f"\n{len(broken)} broken:\n")
        for doc, lineno, target in broken:
            print(f"  {doc}:{lineno}  ->  {target}")
        return 1
    print("all resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main())
