# Editor host

`EditorHostService` mounts typed editors inside the custom app popover or an Angular Material dialog. Provide it at the owning table or feature component. Each instance permits one active editor and closes that editor when its owner is destroyed.

Import supported contracts from `src/app/shared/grid-cells/editing/editor-host/public-api.ts`. The host handles presentation only; editor actions call feature persistence directly.

## Provider scope

```ts
@Component({
  providers: [EditorHostService, FeaturePersistence],
  // ...
})
export class FeatureTable {
  private readonly editorHost = inject(EditorHostService);

  readonly gridContext = { editorHost: this.editorHost };
}
```

The host captures this component's injector and destruction scope internally. Hosted editors inherit the feature's providers. Opening does not require passing an injector or DestroyRef. Provide the host at the table component, not at root or on individual virtualized renderers.

## Editor contract

```ts
export interface HostedEditor<D> {
  readonly data: InputSignal<D>;
}

export interface EditorDefinition<D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: NoInfer<D>;
}
```

An editor declares a signal `data` input. It can alias that input. The host binds it before the first render and `ngOnInit`. Each editor owns its data shape, draft and validation. A dirty signal is optional editor state and is not part of the host contract.

Editors inject `EditorRef` and call `close()` after a successful committed save or an explicit cancellation. `EditorRef` exposes the same interface in both presentations. An old reference cannot close a later editor.

## Opening

```ts
const ref = editorHost.open(
  { component: DetailsEditor, data: detailsData },
  { kind: 'popover', options: { width: 320, placement: 'bottom' } },
  { trigger },
);
```

Use `{ kind: 'dialog', options: { width: 640, title: 'Details' } }` to host the same editor in Material. Popovers accept app PopoverOptions, including anchors and scrollable. Dialogs accept the narrow DialogOptions configuration. Internal mounting panels and native references remain private.

Opening returns undefined if this host already has an editor, its owner has been destroyed, or the trigger is disconnected. An invalid data-input contract or editor initialization failure throws after disposing its presentation. The host remains available for a subsequent opening.

`editorHost.close()` dismisses the owner's current editor. A feature can use this on an unrelated dataset reset. The host performs no row lookup or table reconciliation.

## Dismissal and lifetime

- Popovers and dialogs default to a backdrop with outside-click dismissal. Set backdrop=false or closeOnBackdropClick=false to change that behavior. Escape always dismisses the latest registered overlay.
- Popovers default to blocking background scrolling. Set scrollable=true to allow background scrolling and repositioning. Editors can scroll internally in either presentation.
- An anchored popover closes when its trigger or explicit element anchor disappears. A dialog can remain open after its trigger disappears; it closes on feature destruction or dismissal.
- Popovers use app focus trapping/restoration. Material dialogs use their focus trap; the host restores focus to a connected trigger or the previously focused element when available.
- Closing destroys presentation resources and the editor. Submitted persistence work keeps the lifetime assigned by the feature; the host does not cancel or manage saves.

A complete Angular-compiled consumer example is in `type-tests/docs/editor-host-example.ts`. Presentation types and editor/data rejection checks are covered by `type-tests/editing-redesign`.

`active()` reports whether this owner currently has an editor. `isOpen(ref)` reports whether a particular reference is still the active one. A dropdown renderer can derive its expanded state from this method rather than retaining a close subscription.

Focus restoration runs after the next render so controls disabled while an editor is open can become focusable again. It prefers the activation trigger, then the previous connected focus target. If both disappear, it falls back to a focusable control in the owning feature element. This fallback is presentation behavior and performs no grid lookup.
