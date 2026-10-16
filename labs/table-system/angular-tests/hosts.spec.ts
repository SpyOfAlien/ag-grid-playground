import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  input,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { POPOVER_REF } from '../../../src/app/shared/popover/popover-ref';
import { TableEditorHost } from '../../../src/app/shared/table-system/hosts/editor-host';
import { EditorSession } from '../../../src/app/shared/table-system/editors/editor-session';
import { NumberEditor } from '../../../src/app/shared/table-system/editors/number-editor';
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Owner {
  readonly lifetime = inject(DestroyRef);
  readonly injector = inject(Injector);
}
@Component({ template: '{{ value() }}', changeDetection: ChangeDetectionStrategy.OnPush })
class SelfClosing {
  readonly value = input.required<string>();
  readonly ref = inject(POPOVER_REF);
}
function session() {
  return new EditorSession(
    1,
    { rowId: 'r', columnId: 'amount' },
    1,
    async () => ({ kind: 'committed', submissionId: 1 }),
    () => {},
  );
}
describe('new presentation adapters', () => {
  let trigger: HTMLButtonElement;
  beforeEach(() => {
    trigger = document.createElement('button');
    document.body.append(trigger);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    trigger.remove();
  });
  it('replayed close during popover initialization is consumed after disposal', () => {
    const owner = TestBed.createComponent(Owner);
    const draft = session();
    TestBed.inject(TableEditorHost).openPopover(
      SelfClosing,
      draft,
      trigger,
      owner.componentInstance.injector,
      owner.componentInstance.lifetime,
      (component) => {
        component.setInput('value', 'ready');
        component.instance.ref.close();
      },
      () => {},
      () => true,
    );
    expect(draft.closed).toBe(true);
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('.cdk-overlay-pane'),
    ).toBeNull();
  });
  it('session dismissal during initialization closes the mounted popover without leaked resources', () => {
    const owner = TestBed.createComponent(Owner);
    const draft = session();
    TestBed.inject(TableEditorHost).openPopover(
      NumberEditor,
      draft,
      trigger,
      owner.componentInstance.injector,
      owner.componentInstance.lifetime,
      (component) => {
        component.setInput('session', draft);
        draft.close();
      },
      () => {},
      () => true,
    );
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('.cdk-overlay-pane'),
    ).toBeNull();
  });
  it('owner destruction disposes both popover and dialog resources', () => {
    const owner = TestBed.createComponent(Owner);
    const host = TestBed.inject(TableEditorHost);
    const popover = session();
    host.openPopover(
      NumberEditor,
      popover,
      trigger,
      owner.componentInstance.injector,
      owner.componentInstance.lifetime,
      (component) => component.setInput('session', popover),
      () => {},
      () => true,
    );
    owner.destroy();
    expect(popover.closed).toBe(true);
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('.cdk-overlay-pane'),
    ).toBeNull();
    const dialogOwner = TestBed.createComponent(Owner);
    const dialog = session();
    host.openDialog(
      NumberEditor,
      dialog,
      dialogOwner.componentInstance.injector,
      dialogOwner.componentInstance.lifetime,
      (component) => component.setInput('session', dialog),
    );
    dialogOwner.destroy();
    expect(dialog.closed).toBe(true);
    expect(
      TestBed.inject(OverlayContainer).getContainerElement().querySelector('.cdk-overlay-pane'),
    ).toBeNull();
  });
});
it('dialog dismissal during initialization also releases resources', () => {
  const owner = TestBed.createComponent(Owner);
  const draft = session();
  TestBed.inject(TableEditorHost).openDialog(
    NumberEditor,
    draft,
    owner.componentInstance.injector,
    owner.componentInstance.lifetime,
    (component) => {
      component.setInput('session', draft);
      draft.close();
    },
  );
  expect(
    TestBed.inject(OverlayContainer).getContainerElement().querySelector('.cdk-overlay-pane'),
  ).toBeNull();
  owner.destroy();
});
