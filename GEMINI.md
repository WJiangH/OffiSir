# Gemini Tutor Agent Entry Point

This file is the Gemini bootstrap layer for this repo. It exists to tell Gemini
what to load first and which deeper files own the actual policy and workflow.

## Layer Contract

- Owns: Gemini startup order, Gemini-only execution notes, and the instruction
  load graph.
- Must not contain: repo-wide policy, project-specific rubric logic, or
  role-specific procedures that belong in `AGENTS.md` or `skills/`.
- Loads next:
  1. `AGENTS.md`
  2. The relevant role skill under `skills/`
  3. The active project's `tier1-skill.md` if the role skill requires it
  4. The project context files named by that role / Tier 1 layer

## Canonical Load Order

1. Read `AGENTS.md`.
2. Identify the active project or the project named by the user.
3. Route to the correct role skill using the rules in `AGENTS.md`.
4. If the role skill is layered, load the active project's
   `projects/<project>/tier1-skill.md`.
5. Load the project context files named by that role / Tier 1 layer.
6. Execute the task.

## Gemini-Specific Execution Notes

- Prefer direct file inspection over assumptions.
- Prefer runnable verification when deliverables include executable code,
  queries, formulas, or other directly testable logic.
- For review tasks, treat `Starfleet.pdf` or equivalent submission artifacts as
  the source of truth for what the L0 submitted.
- Use Gemini's visual strengths when the task genuinely depends on layout,
  charts, images, or rendered documents, but keep scoring grounded in the same
  shared project rules.
- For `.docx` files, use `textutil -convert txt -stdout <file>` when plain-text
  extraction is useful.
- For PDF files, read them directly or extract text / images as needed for
  verification.
- Keep outputs deterministic and grounded in the actual deliverables.
- Before writing to Google Workspace or Slack, follow the confirmation rule in
  `AGENTS.md`.

## Skill Source of Truth

Canonical repo skills live under `skills/`.

If mirrored runtime copies also exist under other tool-specific locations, they
must stay semantically aligned with the repo-local files. Do not maintain two
different versions of the same skill logic.
