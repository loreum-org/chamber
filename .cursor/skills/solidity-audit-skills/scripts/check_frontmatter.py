#!/usr/bin/env python3
"""Validate SKILL.md frontmatter across every collection.

Asserts each skill declares `name` and `description`, that `name` is kebab-case,
and reports names that are not unique repo-wide. Uniqueness matters for
registering these skills with an agent runtime: two skills sharing a name cannot
both be installed flat.

Findings in `sources/omega/` are FATAL — that is our own content. Findings in the
mirrored collections are REPORTED but not fatal: they are upstream facts, and
"fixing" them would mean diverging from the mirror, which costs more than it
buys. Pass --all-fatal to enforce everywhere.

Usage:  python3 scripts/check_frontmatter.py [--all-fatal] [--strict-dirname]
Exit:   0 clean, 1 on a fatal error.
"""
from __future__ import annotations
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = ("name", "description")
NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def parse_frontmatter(text: str) -> dict[str, str] | None:
    """Minimal `key: value` frontmatter parser (no YAML dependency in CI)."""
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    body = text[3:end]

    fields: dict[str, str] = {}
    key = None
    for line in body.splitlines():
        if not line.strip():
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s?(.*)$", line)
        if m:
            key = m.group(1)
            fields[key] = m.group(2).strip().strip("\"'")
        elif key and line.startswith((" ", "\t")):
            fields[key] += " " + line.strip()
    return fields


OURS = "sources/omega/"


def main() -> int:
    strict_dirname = "--strict-dirname" in sys.argv
    all_fatal = "--all-fatal" in sys.argv
    errors: list[str] = []
    by_name: dict[str, list[str]] = defaultdict(list)
    count = 0

    for skill in sorted(ROOT.glob("sources/**/SKILL.md")):
        rel = skill.relative_to(ROOT)
        count += 1
        fields = parse_frontmatter(skill.read_text())

        if fields is None:
            errors.append(f"{rel}: no frontmatter block")
            continue

        for field in REQUIRED:
            if not fields.get(field):
                errors.append(f"{rel}: missing or empty `{field}`")

        name = fields.get("name", "")
        if name:
            by_name[name].append(str(rel))
            if not NAME_RE.match(name):
                errors.append(f"{rel}: name `{name}` is not kebab-case")
            if strict_dirname and name != skill.parent.name:
                errors.append(
                    f"{rel}: name `{name}` != directory `{skill.parent.name}`"
                )

        desc = fields.get("description", "")
        if desc and len(desc) < 40:
            errors.append(f"{rel}: description is {len(desc)} chars — too thin to route on")

    collisions = {n: paths for n, paths in by_name.items() if len(paths) > 1}

    fatal = [e for e in errors if all_fatal or e.startswith(OURS)]
    upstream = [e for e in errors if e not in fatal]

    print(f"checked {count} SKILL.md files, {len(by_name)} distinct names")

    if collisions:
        n_paths = sum(len(p) for p in collisions.values())
        print(
            f"\n{len(collisions)} name collision(s) across {n_paths} files "
            f"— these cannot be registered flat in one runtime:"
        )
        for name, paths in sorted(collisions.items()):
            dirs = ", ".join(sorted({Path(p).parent.parent.name for p in paths}))
            print(f"  {name:<38} x{len(paths)}  ({dirs})")
        print("  (upstream namespaces these by directory; flat installation needs a prefix)")

    if upstream:
        print(f"\n{len(upstream)} upstream issue(s) — reported, not fatal:")
        for e in upstream:
            print(f"  {e}")

    if fatal:
        print(f"\n{len(fatal)} FATAL error(s) in our own content:")
        for e in fatal:
            print(f"  {e}")
        return 1

    print("\nno fatal errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
