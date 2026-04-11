# Tutor Agent System

This is the canonical repo-level operating contract for the tutor-agent system.

## Layer Contract

- Owns: repo-wide policy, project layout, skill routing, shared safety rules,
  and file conventions.
- Must not contain: Codex bootstrap notes, role-specific step-by-step
  procedures, or project-specific rubric logic.
- Loads next:
  - Role skills under `skills/`
  - Project overlays under `projects/<project>/tier1-skill.md` when a role
    skill requests them

## System Scope

This is a multi-project AI tutor agent for xAI training projects. It assists
with reviewing, scoring, drafting, and organizing work across multiple
projects.

## Project Layout

Each project may contain some or all of the following:

- `tier1-skill.md` — project-specific overlay used by layered role skills,
  especially project-specific review behavior
- `guidelines.md` or `guideline.md` — task instructions for L0 work
- `examples.md` or `example.md` — calibration examples, if the project uses them
- `rubrics.md` — L1 scoring standard
- `config.yaml` — optional project configuration when the project actually uses
  one

Role skills and project overlays must name the exact files they require. Do not
assume every project has the same filenames.

To create a new project, copy `projects/_template/` to `projects/<name>/` and
fill in the relevant files.

## Switching Projects

The user switches projects by saying `switch to project <name>`.

When switching:

1. Load the project's `tier1-skill.md` if present.
2. Load the project context files that actually exist and that the project
   overlay or role skill requires.
3. Confirm the switch to the user with the project name and a short
   description.

## Shared Routing Tiers

### Tier 1 — Reviews & Scoring

High-stakes evaluation tasks requiring maximum accuracy.

- Primary: strongest available reasoning model
- Cross-check: use a second strong model or reviewer when the task is
  borderline, ambiguous, or high-impact

Use Tier 1 for: final review scoring, rubric application, quality audits, and
disagreement resolution.

### Tier 2 — Execution & Drafting

Mid-complexity tasks requiring strong reasoning or specialized capabilities.

- Use web-enabled tooling only when the task genuinely requires current
  information.
- Use code execution for runnable deliverables and reproducible checks.
- Use document/file tooling for structured task artifacts.

Use Tier 2 for: writing responses, generating examples, code tasks, and data
processing.

### Tier 3 — Admin & Organizing

Low-complexity tasks where speed and cost matter more than depth.

Use Tier 3 for: tagging, sorting, formatting, metadata extraction, and simple
lookups.

## Shared Operating Rules

- Do not modify project instruction files such as `guidelines.md`,
  `guideline.md`, `examples.md`, `example.md`, or `rubrics.md` unless the user
  explicitly asks.
- When asked to access a spreadsheet by name, check `sheets_registry.yaml`
  first.
- Before writing to external systems such as Google Docs, Sheets, Drive, or
  Slack, confirm with the user.
- Never output secrets or raw credentials.

## Skills

Canonical repo skills live under `skills/`:

- `skills/reviewer/SKILL.md` — review and score submissions against rubrics
- `skills/documenter/SKILL.md` — read/write Google Sheets, Docs, and Drive files
- `skills/task-executor/SKILL.md` — execute tasks per project guidelines
- `skills/qa-responder/SKILL.md` — answer questions about guidelines, rubrics,
  and project context
- `skills/organizer/SKILL.md` — manage queues, track progress, sort and tag
  items
- `skills/slacker/SKILL.md` — mine Slack channels for FAQs, unresolved
  questions, and project updates

If mirrored runtime copies also exist under `.codex/skills/`, the repo-local
files remain authoritative and the mirrors must stay aligned.

## Skill Routing

- When asked to review, score, or evaluate tasks, load
  `skills/reviewer/SKILL.md`.
- When asked to read/write Sheets, Docs, or Drive files, load
  `skills/documenter/SKILL.md`.
- When asked to answer questions about guidelines or rubric interpretation, load
  `skills/qa-responder/SKILL.md`.
- When asked to organize, track progress, or update status, load
  `skills/organizer/SKILL.md`.
- When asked to scan Slack channels, summarize Slack topics, or update FAQ
  artifacts, load `skills/slacker/SKILL.md`.
- Role skills may call each other when needed.
- When asked to `l0 task_NNN in project of agent_arena`, load
  `projects/agent_arena/tutor-l0-skill.md`. Do not load the reviewer chain.
- When asked to `l0 task_NNN for autoGDPVal`, load
  `projects/autoGDPVal/tutor-l0-skill.md`. Do not load the reviewer chain.
- When asked to `judge task_NNN for autoGDPVal`, load
  `projects/autoGDPVal/judger-skill.md`.
- When asked to `l0 prompt of project of grok_computer_office_trials in task-N`,
  `regenerate prompt for task-N`, or `iterate task-N` in the
  `grok_computer_office_trials` project, load
  `projects/grok_computer_office_trials/l0-tutor-skill.md`. Do not load the
  reviewer chain.

## Review Batch Conventions

Root: `/Users/wjhuang/Desktop/xAI/tutor-agent`

- Project-specific Tier 1 reviewer overlays live at
  `projects/<project>/tier1-skill.md`.
- Review batch input: `projects/<project>/active/active_task_<N>/`
- Review batch output: `projects/<project>/active/finished_task_<N>/`
- Per-task review file: `task-<X>-review-<agent>.md`
- Per-batch summary file: `summary-<agent>.md`
- Read the prompt once per batch, then review each `task-*` folder
  independently.
- Never read or reference another agent's review file when producing a new
  review.

## Tools

Third-party tool references live in `tools/`.

- `tools/gws-sheets` — Google Sheets CLI operations
- `tools/gws-drive` — Google Drive file operations
- `tools/gws-docs` — Google Docs operations
- `tools/gws-shared` — shared auth, safety, and shell guidance
