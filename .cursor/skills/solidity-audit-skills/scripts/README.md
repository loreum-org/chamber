# Verification scripts

Stdlib Python, no dependencies, no install step. Run any of them from the repo
root; all three run in CI on every PR (`.github/workflows/verify.yml`).

```bash
python3 scripts/check_links.py         # every path referenced in the docs exists
python3 scripts/check_frontmatter.py   # SKILL.md frontmatter + name collisions
python3 scripts/check_provenance.py    # .provenance records are consistent
```

## check_links.py

Asserts every repo-relative path named in `README.md`, `ATTRIBUTIONS.md`,
`CORRELATIONS.md`, `library/*.md` and the omega docs resolves on disk.

Those indexes are hand-maintained across ~20 sections and are the main thing a
rename silently rots. Placeholder paths — anything containing `<`, `>`, `*` or
`...` — are documentation rather than assertions and are skipped.

Skill bodies are **not** scanned: they are prose and legitimately name
illustrative paths that do not exist.

## check_frontmatter.py

Asserts each `SKILL.md` declares a non-empty `name` and `description`, that
`name` is kebab-case, and that the description is long enough to route on.
Reports names that collide repo-wide.

**Fatal vs reported.** Problems in `sources/omega/` fail the build — that is our
own content. Problems in the mirrored collections are reported but do not fail:
they are upstream facts, and "fixing" them means diverging from the mirror,
which costs more than it buys. `--all-fatal` enforces everywhere.

Currently reported (both upstream, both expected):

- **19 name collisions across 83 files**, all in `sources/plamen/`, where the
  same skill name appears under several language directories. Upstream
  namespaces these by path; installing them flat in one runtime would need a
  prefix. Relevant to issue #3.
- One injectable fragment with no frontmatter block — it is a prompt fragment
  rather than a registrable skill.

Flags: `--all-fatal`, `--strict-dirname` (also require `name` == directory name).

## check_provenance.py

Validates every `sources/*/.provenance`: well-formed JSON, required fields
present, full 40-character SHA, and `files_mirrored` matching what is actually
on disk. That last check is what catches a mirror being edited in place.

`--online` additionally queries each upstream's default-branch HEAD and reports
drift. Runs weekly and on demand, not on PRs — a PR should not fail because
someone else pushed to an upstream repo, and should not depend on the network.

Drift is reported, not failed, unless `--fail-on-drift` is passed. A mirror
being behind upstream is a fact worth surfacing on a known date, not an error.

## Re-establishing provenance

The mirrors carry no `.git`, so their SHAs were recovered by content match:
hash every mirrored file, then walk upstream history for the commit whose tree
matches. Repeat that if a record is ever lost:

```bash
git clone --filter=blob:none <upstream> /tmp/up
# for each commit, compare `git ls-tree -r <commit>` blob SHAs against
# `git hash-object` of the mirrored files; a full match identifies the commit
```

All three sources matched exactly, except one Windows `.cmd` file in `plamen`
whose CRLF line endings were normalised to LF on checkout. That is recorded in
the `known_differences` field of its record rather than papered over.
