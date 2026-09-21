# TypeDoc generated output — not live yet

This is where `pnpm run docs:generate` (see `typedoc.json` at the repo root)
writes its Markdown output today: `docs/reference-generated/`, which is
gitignored and never committed.

## Why not `docs/reference/`

`RELEASE_PASS.md`'s Track X entry for this pipeline is explicit:
`docs/reference/`, `docs/manual/`, `ai/CLAUDE.md`, `ai/api-reference.json`,
and the `emptysock-ai-skills` skill files must not be touched to describe
v2 shapes until the §9 docs pass starts, after the API in Tracks 0-2 is
real. Wiring TypeDoc straight at `docs/reference/` today would mean that
directory starts describing whatever partially-migrated v1/v2 shape happens
to exist right now, which is exactly what that instruction rules out.

The reconciliation: build and verify the pipeline now (per ENGINE_DESIGN.md
§19.1 — "can start against v1 code now ... rather than waiting"), but point
its output at a scratch, gitignored directory instead of the real reference
tree, so nothing premature gets committed.

## How to go live

When the §9 docs pass actually starts (after Tracks 0-2's API is real):

1. In `typedoc.json`, change `"out": "docs/reference-generated"` to
   `"out": "docs/reference"`.
2. Remove the `docs/reference-generated/` line from `.gitignore`.
3. Run `pnpm run docs:generate` and commit the result.

That single config edit is the intentional trigger — nothing else about
the pipeline (entry points, plugin, script) needs to change.
