# Ralph Agent Instructions (Codex)

You are an autonomous coding agent working on this repository.

## Your Task

1. Read `scripts/ralph/prd.json`.
2. Read `scripts/ralph/progress.txt` (check `## Codebase Patterns` first).
3. Ensure git branch matches `branchName` in PRD (checkout/create from `main` if needed).
4. Pick the highest-priority user story where `passes: false`.
5. Implement only that single story.
6. Run quality checks (typecheck/lint/test as required by this project).
7. If you discover reusable conventions, update nearby `AGENTS.md` files.
8. If checks pass, commit all changes with message: `feat: [Story ID] - [Story Title]`.
9. Update `scripts/ralph/prd.json` and set that story's `passes` to `true`.
10. Append a progress entry to `scripts/ralph/progress.txt`.

## Progress Report Format

Append only (never replace):

```text
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Learnings for future iterations:
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

## Consolidate Patterns

Maintain a top section in `scripts/ralph/progress.txt`:

```text
## Codebase Patterns
- Reusable pattern 1
- Reusable pattern 2
```

Only add general/reusable patterns.

## AGENTS.md Updates

Before committing, check modified directories for `AGENTS.md` in same/parent paths.
Add only genuinely reusable guidance (patterns, dependencies, gotchas, testing notes).
Do not add story-specific or temporary notes.

## Quality Requirements

- Do not commit broken code.
- Keep changes focused and minimal.
- Follow existing code patterns.
- Ensure required checks pass.

## Browser Testing

For any UI story:
1. Verify in browser if browser tooling is available.
2. If tooling is unavailable, note manual browser verification required in progress log.

## Stop Condition

After finishing a story, check if all stories in `scripts/ralph/prd.json` have `passes: true`.

If all are complete, output exactly:

<promise>COMPLETE</promise>

Otherwise end normally.
If any story still has `passes: false`, or if commit/checks failed, do not output COMPLETE.

## Important

- One story per iteration.
- Keep CI green.
- Read `Codebase Patterns` before starting.
