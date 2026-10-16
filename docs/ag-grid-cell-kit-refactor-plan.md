# Cell kit refactor implementation plan

Integration update: the runtime CellKit directive described in this historical plan is superseded by [signal-driven presentation and declarative keyboard configuration](cell-kit-signal-driven-plan.md). Current setup is documented in [grid integration](cell-kit-integration.md).

This is the implementation record for the earlier refactor. New editing work follows [the editing redesign implementation plan](cell-kit-editing-redesign-plan.md). Its pending verification checklist does not define the new target design.

Status: phases 1–6 complete. Phase 7 remains pending. Production contracts support authoritative table updates, pure command building, one editor-opening interface, and directive-based table integration.

## Objective

Reduce editor-opening, save-submission, and table-integration complexity while preserving renderer-specific configuration, independently computed cell categories, Material editors, native cell controls, custom popovers, and Material dialogs. Support authoritative backend updates to a row set.

The implementation and reader-facing documentation must describe the same supported interface. Documentation explains design, flow, configuration, and usage without meeting notes, discussion references, implementation chronology, or abandoned approaches.

## Target execution paths

```text
Pen → CellEditorService.open → PopoverService or MatDialog → configured editor
Save → CellEditService.submit → EditPersistence.save → TableStateAdapter.apply
     → AG Grid integration refresh
```

Keep positioning, interaction locking, session binding, and dialog mounting as private implementation details when their behavior warrants a separate file. Remove public forwarding-only modules rather than hiding an unchanged chain behind another facade.

## Target public contracts

- Preserve BaseCell, CellContext, GridContext, CellRule, category models/resolvers, and renderer-specific params.
- EditorDefinition links a typed editor component and its configuration.
- EditorSession contains opening row/value, identity, configuration, edit port, and close callback. Dirty is optional.
- CellEditorPort has one open method with a discriminated popover/dialog request.
- EditCommand contains originating row/column, proposed changes, optional operation, and optional query parameters.
- SaveOperation and persistence receive the command and current row and return TableUpdate.
- TableUpdate distinguishes a local row patch from an authoritative row-set update. Full replacement deletes omitted rows; partial upsert retains them. Include only the row-set semantics required by the supported backend contract.
- EditResult separates originating cell identity from the update's affected rows.
- TableStateAdapter supplies current-row lookup, current-row authorization, and atomic apply(update).
- buildEditCommand is a pure optional helper for generic controls. Complex editors can build commands directly.
- provideCellKit and CellKit grid integration replace manual host/provider/context/refresh wiring.

Current type definitions and folder layout are in [the design guide](ag-grid-cell-kit-design.md). Freeze their final shape in compile-only examples before implementation. Do not publish an unimplemented target as the current usage interface.

## Phase 1: Finalize contracts and acceptance examples

- [x] Define explicit backend full-replacement and partial-upsert protocols, including deletion semantics and stable IDs; API adapters must select the matching result variant.
- [x] Specify command, operation, table-update, result, persistence, and state-adapter types.
- [x] Specify one editor-opening interface and typed grid integration, including custom application context.
- [x] Define table-wide save ordering, dataset-reset invalidation, and late responses after table destruction.
- [x] Add compile-only target examples for generic/complex editors, client/server saves, and the small consumer setup.
- [x] Define defaults for transparent popover backdrops, dialog backdrops, outside click, Cancel, and Escape. Preserve explicit presentation overrides.

Deliverable: an agreed implementation contract with executable type examples. Existing production code remains working; isolate target examples until the implementation supports them.

Verification: npm run test:types and production build pass. Isolated target contracts and valid usage fixtures are in type-tests/refactor, with 15 expected rejection cases in addition to the existing type suite. The [design guide](ag-grid-cell-kit-design.md) defines row-set semantics, dataset generation, table-wide ordering, destruction, typed opening, and cancellation defaults. The grid binding was initially compile-checked as a TypeScript contract; phase 5 added production Angular directive/template verification. Editing contracts were adopted by the production kit in phase 2. Editor-opening contracts were adopted in phase 4. Grid-integration contracts were adopted in phase 5.

## Phase 2: Implement authoritative table updates

- [x] Replace RowUpdate with TableUpdate throughout persistence, edit results, state adapters, and API response mapping.
- [x] Remove SaveRequest/PersistenceRequest forwarding models. Pass EditCommand and the resolved current row to persistence and operations.
- [x] Implement table-wide queuing with authorization against current row state before execution.
- [x] Prevent responses associated with obsolete datasets or destroyed tables from applying to their replacement instances. Define how reload/reset integrations invalidate queued or pending work.
- [x] Allow a valid server result to remove the originating row; remove the old post-save origin-row-exists assumption.
- [x] Keep client patches and server row sets as separate persistence implementations.
- [x] Update the demo response fixture to recalculate several rows and demonstrate the supported row-set semantics.
- [x] Remove demo-only forwarding subclasses; keep mode switching local to the demo if still required.

Verification: multiple dependent rows update atomically, deletion semantics are correct, failure preserves committed state, queued commands use current rows, and reset/navigation races cannot overwrite unrelated datasets. A table-wide queue does not replace backend concurrency/revision controls.

Deliverable: backend recalculation works through one submission interface. Production contracts are defined in `editing/edit.model.ts` and `editing/table-update.model.ts`. The demo applies full replacement responses and recalculates a dependent row. External dataset resets increment the adapter generation. Table destruction rejects pending submissions and prevents late responses from applying. Successful results retain only the latest response to avoid retaining multiple full datasets.

Completed checks: 153 unit tests, 47 browser tests, production build, and type checks including 39 expected rejection cases. Browser coverage includes dependent-row recalculation, cross-row save ordering, and reset protection.

## Phase 3: Consolidate command building

- [x] Replace submitEditorValue and submitCellValue with buildEditCommand.
- [x] Migrate InputEditor, TextareaEditor, dropdown editor, toggle controls, and the composite example to explicit build → submit.
- [x] Keep complex editor actions submitting their own commands and selecting their own operations.
- [x] Preserve optional validation, configured permissions, toChanges, static/dynamic query parameters, and typed editor configuration.
- [x] Remove redundant public helper exports and update type examples.

Verification: number/null/zero values, object-valued dropdown choices, disabled actions, queries, alternate backend actions, pending guards, and failure/retry behavior remain correct.

Deliverable: one pure mapping helper and one execution method, with no helper-to-helper forwarding. `editing/build-edit-command.ts` returns a typed command and throws for missing identity or configured permission denial. Generic editors adapt their session locally, then call session.edit.submit. Direct controls build from CellContext and call context.edit.submit. Complex editors continue to choose operations and submit their own commands. The two submission-helper files and exports are removed.

Completed checks: 159 unit tests, 47 browser tests, production build, and type checks including 39 expected rejection cases. Command-builder tests cover pure mapping, dynamic/static query params, object-valued drafts, zero/null values, configured denial, and missing identity. Existing editor and browser checks cover validation, pending guards, alternate actions, and failure/retry behavior.

## Phase 4: Consolidate editor presentation

- [x] Move table editor lifecycle into CellEditorService, including active session, session construction, scroll lock, Escape, cleanup, and focus restoration.
- [x] Replace openPopover/openDialog with the typed open request.
- [x] Use the existing custom PopoverService and MatDialog internally. Preserve anchor/placement/arrow/dimension options and Material content layout.
- [x] Make dirty optional and update runtime session validation.
- [x] Default popovers to transparent outside-click cancellation and dialogs to dismissible standard backdrops. Cancel/Escape discard unsubmitted drafts. Save failure keeps the editor open.
- [x] Remove EditorPresentations and injectable host forwarders after all callers migrate. Keep behavioral private helpers where useful.

Verification: keyboard opening, focus trap/restore, backdrop options, unconditional Escape, internal scrolling, grid scroll lock, row/anchor removal, and table destruction. Submitted saves retain their lifetime when only the presentation closes.

Deliverable: renderers open editors through one public interface. `editing/cell-editor-service.ts` owns the lifecycle and privately selects PopoverService or MatDialog. GridContext exposes CellEditorPort.open with discriminated presentation options. The old coordinator and injectable host forwarders are removed; session binding, grid locking, and the Material panel remain behavioral implementation helpers. provideCellEditorHosts now supplies only CellEditorService until phase 5 replaces the manual integration setup.

Completed checks: 163 unit tests, production build, and type checks including 39 expected rejection cases. The browser suite passed 48 of 49 checks initially; the composite DOM-retention check failed before editor opening and passed on its isolated rerun. Unit coverage exercises editors without dirty signals, invalid optional dirty members, default/explicit backdrop dismissal, no-backdrop Escape, session isolation, cleanup, row/anchor removal, and lock release. Browser coverage verifies transparent popover backdrops, outside-click draft cancellation for both presentations, submitted-request lifetime, focus, scrolling, and accessibility.

## Phase 5: Consolidate table integration

- [x] Introduce provideCellKit(StateAdapter, PersistenceFacade).
- [x] Create CellKit directive attached to AgGridAngular, with a typed state input and exported stable context.
- [x] Move grid-ready connection, context wiring, data reconciliation, refresh timing, and cleanup into the directive.
- [x] Compose custom context and keyboard callbacks without overwriting application behavior.
- [x] Keep application state as the only writable row source; do not add a mirrored store inside the directive.
- [x] Refresh affected visible rows for patches/upserts and reconcile the complete dataset for replacement results.
- [x] Define externally driven state updates and immutable row requirements. Bind grid events and cleanup using installed AG Grid APIs.
- [x] Replace manual demo integration and complete the target consumer type examples.

Verification: initial connection, metadata-only refresh, dataset replacement, external updates, sorting/filtering, stable row identity, pinned columns, virtualization, and destruction. The initial implementation targets the demonstrated client-side row model; document other row models as requiring explicit supported integration rather than claiming automatic compatibility.

Deliverable: one provider call and one grid integration directive for consuming tables.

Completed checks: 170 unit tests, 49 browser tests, production build, and type checks including 42 expected rejection cases. Application and integration-test templates check CellKit bindings and typed context extensions. Unit coverage verifies stable context updates, adapter identity, table isolation, batched metadata refresh of affected visible rows, dynamic keyboard callback composition, and listener/presentation cleanup. Existing browser scenarios exercise the directive through client/server edits, full-dataset responses, metadata-only changes, navigation, cancellation, and accessibility.

Production files: `editing/cell-kit-providers.ts`, `integration/cell-kit.ts`, and the private `integration/cell-kit-keyboard.ts`. The demo uses one provider and directive, with no manual connect/reconcile/refresh effects or context closures. The old provider helpers and demo affected-row accumulator are removed. Immutable row references determine affected visible rows; explicit grid API refresh remains required for unrelated in-place mutations. Application context fields are supplied through cellKitContext, with edit/editors reserved.

## Phase 6: Rewrite reader-facing documentation

Use three focused guides and a short README:

| File                            | Purpose and required content                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README.md                       | What the kit provides, dependencies, running the demo, verification commands, and links to the guides.                                                                          |
| docs/ag-grid-cell-kit-design.md | Architecture, folder structure, module ownership, type contracts, composition rules, lifecycle, state authority, concurrency, and performance constraints.                      |
| docs/cell-kit-flows.md          | Pen/open flow, Save flow, client/server branches, row-set application, failure/retry, cancellation, resets, and cleanup. Include actual file/method paths.                      |
| docs/cell-kit-usage.md          | Minimal display-only and editable setups, typed renderer params, generic and complex editors, API operations, table-state adapter, Material theme/styles, and supported limits. |

- [x] Rewrite the design document instead of appending another implementation-stage section. Remove contradictory historical rules and obsolete folder/type examples.
- [x] Write the flow guide using the final call paths. Explain who owns each action without requiring knowledge of implementation phases.
- [x] Rewrite usage examples against the final public entry point. Distinguish client patches, backend row-set results, and full versus partial dataset semantics.
- [x] Keep examples small and complete enough to compile. Place corresponding fixtures under type-tests so docs do not drift.
- [x] Reduce README duplication and remove completed-step/migration narration from onboarding.
- [x] Remove obsolete implementation/migration/simplification plans when their useful content is incorporated. Retain this refactor checklist only as a work record, separate from reader-facing guides.
- [x] Preserve measured baseline JSON and performance reports as historical evidence. Label environment, workload, and date; do not rewrite old observations to describe new code.
- [x] Replace obsolete links and verify local paths.

Writing rules: describe the implemented design in present tense. Explain concrete constraints and tradeoffs, not discussion history. Avoid phrases such as "as discussed", "you requested", "we agreed", "step N added", and "previously we chose". Mark unsupported features and actual limitations directly. Do not present proposals as completed behavior.

Deliverable: a new reader can understand the design, follow open/save behavior, and integrate a table without reading old plans.

Completed checks: production build and test:types pass. The type command includes ngc verification of standalone display-only/editable examples and typed CellKit template bindings. Documentation excerpts match the checked fixtures, and all 59 local Markdown links resolve. Production runtime files and recorded baseline JSON are unchanged.

Published guides: README.md, docs/ag-grid-cell-kit-design.md, docs/cell-kit-flows.md, and docs/cell-kit-usage.md. docs/measurements.md indexes the dated historical evidence. Removed the obsolete implementation, Material migration, simplification, and acceptance-contract documents after incorporating their current rules. This checklist remains a separate work record. The historical Material results report keeps its measurements and has an updated pointer to current usage.

## Phase 7: Final verification and completion

- [ ] Remove obsolete exports and temporary compatibility paths. Verify no remaining caller depends on old hosts, request models, or submission helpers.
- [ ] Run production build, unit tests, and compile-only type checks.
- [ ] Run browser functional/accessibility checks for both presentations, all renderer types, generic/complex editors, server recalculation, and client edits.
- [ ] Repeat editor creation/destruction and confirm zero orphan overlays and released interaction locks.
- [ ] Compare resting renderer DOM with the saved baseline; refactoring must not add permanent wrapper elements.
- [ ] Inspect Material editor screenshots and narrow layouts.
- [ ] Check that every documented public name and call path exists in code and that documented examples compile.
- [ ] Record verification results separately from the design/usage narrative and mark this plan complete only after all required checks pass.

## Completion criteria

A table author configures specific renderers/editors, supplies state/persistence adapters, and attaches one integration directive. A debugger follows one editor-opening entry point and one edit-submission entry point. Confirmed row-set updates apply atomically. Internal behavioral modules remain composable without requiring callers to wire them manually. Reader-facing guides contain current design, execution flow, and practical examples, with no dependency on discussion context.
