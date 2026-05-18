# Muguerza Connect - Claude Working Rules

This file defines how Claude should work in this repository. Read it before
planning or editing code.

## Project Reality

Muguerza Connect is moving toward a real production healthcare environment.
Do not treat features as disposable prototypes. Security, data integrity,
role separation, and auditability matter.

The app is a Vite + React + TypeScript + Supabase desktop-style portal with
doctor and secretary roles. The current source of truth is the live code plus
`FUTURAS_IMPLEMENTACIONES.md`; README or older notes may lag behind.

Before implementing a feature:

1. Read the relevant section in `FUTURAS_IMPLEMENTACIONES.md`.
2. Inspect the existing code paths and Supabase schema assumptions.
3. Identify what is already implemented vs what is only planned.
4. Produce or follow a concrete plan before editing.
5. Update documentation after the implementation is verified.

## Division Of Work

Use this mental model:

- Opus is for product ideation, exploration, and high-level planning.
- Codex is for robust logic, Supabase, security, schema, RLS, indexes,
  production-readiness, and precise handoff prompts.
- Sonnet is for focused implementation once the constraints are clear.

When working as Sonnet, do not re-ideate the whole feature unless asked.
Execute the scoped prompt, verify, and document.

## Hard Rules

- Do not invent or guess Supabase schema. Verify it from code, SQL files, or
  the connected Supabase project.
- Do not change `patient_id` to UUID. In the current live DB, `patients.id`
  and related `patient_id` columns are `text`.
- Do not silently insert financially relevant records with default money values
  like `fee = 0` unless the user intentionally selected a free/courtesy flow.
- Do not bypass RLS or rely on permissive demo policies as a production design.
- Do not expose more patient/doctor data than the active role should see.
- Do not create a "nice looking" UI that has no real data source.
- Do not leave features half-connected. If the UI exists, identify exactly
  which table/view/function feeds it.
- Do not make broad refactors while implementing one feature.
- Do not overwrite user/Codex changes without checking current file content.

## Supabase Expectations

For any Supabase-related task:

1. Verify current schema first.
2. Use RLS for new public tables.
3. Add indexes for dashboard/query paths that will grow.
4. Preserve historical financial data with snapshots.
5. Prefer explicit role policies for doctor and secretary.
6. Run/consider Supabase Advisors after schema/security changes.
7. Document any remaining Advisor warnings.

Feature-specific implementation facts belong in `FUTURAS_IMPLEMENTACIONES.md`,
not in this file. Before working on a feature, read that feature's current
section and treat it as the implementation ledger for what exists, what was
verified, and what remains pending.

## Feature Implementation Method

Every feature should have:

1. Data model and source of truth.
2. Role permissions.
3. Primary user flow.
4. Empty/error states.
5. Edge cases.
6. Validation steps.
7. Documentation update.

If a prompt is ambiguous, stop and clarify with a short question or state the
assumption before editing. Do not fill gaps with a rustic/simple placeholder
when the feature needs real production logic.

## UI/Product Quality

This is an operational healthcare product, not a landing page. Interfaces
should be dense, calm, clear, and usable for repeated daily work.

Use existing design patterns in the repo. Avoid decorative sections, oversized
marketing layouts, or UI that explains itself with tutorial text. Prioritize
clear controls, predictable modals, useful empty states, and compact data
surfaces.

## Documentation Requirements

After meaningful work, update `FUTURAS_IMPLEMENTACIONES.md` with:

- Files created.
- Files modified.
- Supabase changes, if any.
- Technical decisions.
- Validation performed.
- Known limitations and pre-production hardening items.

Do not document aspirational behavior as implemented. Document only what is
actually present and verified.

## Pre-Handoff Checklist

Before saying "done":

- Typecheck/build passes or the failure is documented.
- Relevant Supabase schema was verified if the feature touches data.
- Main user path was tested or clear manual test steps are listed.
- Financial/medical/security edge cases were considered.
- `FUTURAS_IMPLEMENTACIONES.md` reflects the real state.
- Remaining risks are listed plainly.

## Prompt Handoff Pattern

When the user asks to prepare a prompt for Claude/Sonnet, produce a compact
handoff with:

- Context.
- What is already done.
- What not to redo.
- Exact files to inspect.
- Exact Supabase tables/columns involved.
- Implementation tasks.
- Validation checklist.
- Documentation requirements.
- Known pitfalls.

The goal is to reduce token waste and prevent missed requirements.
