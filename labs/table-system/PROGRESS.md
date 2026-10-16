# Implementation progress

Initial status and SHA-256 hashes are recorded in initial-state.json. Existing files are read-only for this work.

Phase 1 implementation added. Acceptance validation pending.

Phase 1 accepted: production build and Chrome browser display/signal checks passed. Development command: `cd labs/table-system && ../../node_modules/.bin/ng serve`. Build uses the same binary with `build`. Sandbox process restriction required normal process permissions for Angular builds and Chrome.

Phase 2 accepted: seven independent model/runtime tests passed, production build passed, and actual Chrome virtualization/shared-target/failure/reset checks passed. AG Grid retains the focused row while scrolling, so virtualization verification first moves logical focus to another row. Target statuses use individual signals; unobserved idle entries are removed and unobserved failures are capped at 256.

Phase 3 accepted: eight independent runtime/session tests, production build, and five browser checks passed. Numeric invalid drafts never submit; failed saves preserve draft; Escape during save leaves operation running; anchor removal disposes overlay; old completions cannot close newer sessions; connected focus returns natively. The adapter consumes the existing replayed `afterClosed` stream after disposal and only schedules logical fallback if the trigger has disappeared and no newer session is active.

Phase 4 accepted: 11 model/runtime/display tests, compile-time expected rejections, production build, and seven browser checks passed. Keyboard entry, exit and reverse traversal work for amount, switch and choice. Column keyboard policy is merged explicitly when columns are built, after actual browser testing found default-column policy alone did not cover all rendered columns. Presentation muting leaves review permission intact.

Phase 5 accepted: 13 unit tests, compile-time checks, production build and composition browser tests passed. Numeric content works unchanged in popover and CDK dialog. Details Save/Approve atomically change the edited row and dependent row with a table-wide scope and submission-time approval policy. Custom toggle-number rendering reuses DirectBinding, SwitchControl and the editor host. Browser evidence required refreshing changed-row renderers even when a displayed scalar remained equal, so metadata annotations stay current.

Phase 6 accepted: 15 unit tests and compile-time checks passed; production build passed; Chrome verified sorting, filtering, grouping, metadata changes, replacement/removal and disconnect/reconnect during accepted saves. Rendering failures preserve the authoritative commit and report a projection fault. Unsubmitted drafts retain generation guards. Group columns explicitly use read-only text content because AG Grid otherwise inherits the grouped column's interactive inner renderer. RowGroupingModule uses the installed AG Grid Enterprise trial; a production license is required for deployment with grouping.

Phase 7 complete: architecture/integration/extension guidance, isolated README commands, public APIs, source-isolation audit, visual evidence and performance results are delivered. Final verification passed 19 independent model/operation/display/session/projection/reactivity tests, seven Angular renderer/control/host tests, strict application and expected-rejection/public-usage type checks, 19 browser behavior/keyboard/AXE checks and the dedicated performance sequence. The unchanged existing popover suite passed 27 tests with its existing npm command. The final production build passed at 1.60 MB raw initial output and approximately 367.64 kB estimated transfer size.

Final review adjustments:

- Default typed value rendering and EditorBinding consume actual display, annotation, target, permission, command and editor/presentation configuration. Inline editor definitions use explicit value/command generics or a declared TableColumn to avoid TypeScript contextual inference ambiguity.
- AG Grid reuses renderer parameter objects. Renderer snapshots copy the parameters on refresh, so changed committed values and metadata recalculate correctly.
- A duplicate invalid submission cannot overwrite pending status. Validation failures also participate in bounded target cleanup.
- Model lookup uses a shared computed identity index, and unaffected immutable row identities survive patches.
- Reusable ChoiceControl supports object equality, disabled and unmatched choices, and pessimistic selection. The composite observes both independent interaction statuses.
- Focus return checks after Angular renders. A restored trigger can become disabled during a pending save, so the new adapter supplies logical-cell fallback only after native restoration cannot retain focus, with feature/new-session and meaningful-focus guards. No shared popover code was changed.
- Errors use a typed RevisionConflictError. Closed submitted drafts still report feature feedback, and open revision-conflict drafts preserve their values without retry.

AXE passed the ordinary and grouped table, popover numeric editor, numeric/text/multiline/choice/details dialogs, and invalid/pending/failed numeric states. Keyboard tests cover entry, internal/reverse traversal, exit, focus trapping, connected restoration, disabled-trigger fallback and first-invalid-field focus. Manual inspection of verification/table.png, verification/details-editor.png and verification/focus.png confirmed legible controls, visible focus and no clipped editor content. Scoped foreground, muted and error colors meet WCAG AA on white; inactive native controls remain visibly disabled. Grouping uses an Enterprise trial watermark and needs a production license before deployment.

Performance results and limitations are recorded in PERFORMANCE.md and performance-results.json. Historical Phase 1 timings were not captured; the measured two-column configuration is reconstructed rather than presented as a historical baseline. All other acceptance behavior has been exercised. No performance improvement or historical non-regression claim is made.

The final hash audit found no changes to pre-existing application, source, documentation, configuration, persistence or test files, and no prohibited imports. npm's ignored cache/log files changed automatically during tool execution and are reported separately. Early browser runs wrote generated root test-result metadata; that metadata was restored byte-for-byte to its starting hash and subsequent results are workspace-local. Existing user edits and deletions are preserved. Migration remains unstarted.
