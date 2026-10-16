import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  InjectionToken,
  inject,
  input,
  signal,
  type InputSignal,
  type OnInit,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { EditorHostService } from './editor-host-service';
import { EditorRef } from './editor-ref';
import type { EditorPresentationAdapter, HostedEditor } from './editor-host.model';
import { provideEditorPresentations } from './presentations';
import { provideGridCellLabels } from '../../core/labels';

declare module './editor-host.model' {
  interface EditorPresentations {
    panel: { readonly side: 'start' | 'end' };
  }
}

interface EditorData {
  readonly label: string;
}

const FEATURE_LABEL = new InjectionToken<string>('feature label');
let nextOwner = 0;

@Component({
  selector: 'test-hosted-editor',
  template: `<input aria-label="Draft" [value]="data().label" />
    <p>{{ featureLabel }}</p>
    <button (click)="ref.close()">Close</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Editor implements HostedEditor<EditorData>, OnInit {
  readonly ref = inject(EditorRef);
  readonly featureLabel = inject(FEATURE_LABEL);

  readonly data = input.required<EditorData>({ alias: 'editorData' });

  ngOnInit(): void {
    // Reading a required input here verifies that binding precedes initialization.
    this.data();
  }
}

@Component({
  selector: 'test-closing-editor',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ClosingEditor implements HostedEditor<EditorData>, OnInit {
  private readonly ref = inject(EditorRef);
  readonly data = input.required<EditorData>();

  ngOnInit(): void {
    this.data();
    this.ref.close();
  }
}

@Component({
  selector: 'test-constructor-closing-editor',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ConstructorClosingEditor implements HostedEditor<EditorData> {
  private readonly ref = inject(EditorRef);
  readonly data = input.required<EditorData>();

  constructor() {
    this.ref.close();
  }
}

@Component({
  selector: 'test-invalid-editor',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class InvalidEditor implements HostedEditor<EditorData> {
  // Intentionally violate the runtime input contract without introducing any.
  readonly data = signal({ label: '' }) as unknown as InputSignal<EditorData>;
}

@Component({
  selector: 'test-throwing-editor',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ThrowingEditor implements HostedEditor<EditorData>, OnInit {
  readonly data = input.required<EditorData>();

  ngOnInit(): void {
    throw new Error('Editor initialization failed.');
  }
}

@Component({
  selector: 'test-dirty-editor',
  template: '<input aria-label="Draft" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DirtyEditor implements HostedEditor<EditorData> {
  readonly data = input.required<EditorData>();
  readonly changed = signal(true);
  readonly dirty = computed(() => this.changed());
}

@Component({
  template: '<div class="owner"><button>Open editor</button></div>',
  providers: [
    EditorHostService,
    { provide: FEATURE_LABEL, useFactory: () => `owner-${++nextOwner}` },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Owner {
  readonly host = inject(EditorHostService);
  readonly lifetime = inject(DestroyRef);
  readonly featureLabel = inject(FEATURE_LABEL);
}

describe('EditorHostService', () => {
  const definition = { component: Editor, data: { label: 'Opening value' } };

  async function setup() {
    const fixture = TestBed.createComponent(Owner);
    await fixture.whenStable();
    // Keep the trigger outside Angular's replaceable test root for multi-owner tests.
    const root = fixture.nativeElement.querySelector('.owner') as HTMLElement;
    document.body.append(root);
    fixture.componentInstance.lifetime.onDestroy(() => root.remove());
    const trigger = root.querySelector('button')!;
    trigger.focus();
    return {
      fixture,
      owner: fixture.componentInstance,
      trigger,
      container: TestBed.inject(OverlayContainer).getContainerElement(),
    };
  }

  async function expectDisposed(container: HTMLElement) {
    await vi.waitFor(() => expect(container.querySelector('.cdk-overlay-pane')).toBeNull());
  }

  for (const kind of ['popover', 'dialog'] as const) {
    it(`${kind} binds aliased data before initialization and inherits feature providers`, async () => {
      const { fixture, owner, trigger, container } = await setup();
      const ref = owner.host.open(definition, { kind }, { trigger });
      expect(ref).toBeDefined();
      await fixture.whenStable();
      expect(container.querySelector('input')?.value).toBe('Opening value');
      expect(container.textContent).toContain(owner.featureLabel);
      expect(owner.host.open(definition, { kind }, { trigger })).toBeUndefined();
      expect(container.querySelectorAll('.cdk-overlay-pane')).toHaveLength(1);
      container.querySelector<HTMLButtonElement>('button')!.click();
      await fixture.whenStable();
      await expectDisposed(container);
      expect(document.activeElement).toBe(trigger);
    });

    it(`${kind} ignores an old editor reference after another opens`, async () => {
      const { fixture, owner, trigger, container } = await setup();
      const first = owner.host.open(definition, { kind }, { trigger })!;
      first.close();
      await fixture.whenStable();
      await expectDisposed(container);
      const second = owner.host.open(definition, { kind }, { trigger })!;
      first.close();
      await fixture.whenStable();
      expect(container.querySelectorAll('.cdk-overlay-pane')).toHaveLength(1);
      second.close();
      await fixture.whenStable();
      await expectDisposed(container);
    });

    for (const component of [ClosingEditor, ConstructorClosingEditor]) {
      it(`${kind} disposes when ${component.name} closes during mounting`, async () => {
        const { fixture, owner, trigger, container } = await setup();
        owner.host.open({ component, data: definition.data }, { kind }, { trigger });
        await fixture.whenStable();
        await expectDisposed(container);
        expect(owner.host.open(definition, { kind }, { trigger })).toBeDefined();
        owner.host.close();
        await fixture.whenStable();
        await expectDisposed(container);
      });
    }

    for (const component of [InvalidEditor, ThrowingEditor]) {
      it(`${kind} cleans up after ${component.name} fails`, async () => {
        const { fixture, owner, trigger, container } = await setup();
        expect(() =>
          owner.host.open({ component, data: definition.data }, { kind }, { trigger }),
        ).toThrow(
          component === InvalidEditor ? 'signal data input' : 'Editor initialization failed',
        );
        await fixture.whenStable();
        await expectDisposed(container);
        expect(owner.host.open(definition, { kind }, { trigger })).toBeDefined();
        owner.host.close();
        await fixture.whenStable();
        await expectDisposed(container);
      });
    }

    for (const dismiss of [undefined, true, false]) {
      it(`${kind} honors backdrop dismissal ${dismiss} and always allows Escape`, async () => {
        const { fixture, owner, trigger, container } = await setup();
        const options = dismiss === undefined ? undefined : { closeOnBackdropClick: dismiss };
        owner.host.open(definition, { kind, options }, { trigger });
        await fixture.whenStable();
        container.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
        await fixture.whenStable();
        if (dismiss === false) {
          expect(container.querySelector('.cdk-overlay-pane')).not.toBeNull();
          const input = container.querySelector('input')!;
          input.addEventListener('keydown', (event) => event.stopPropagation());
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await fixture.whenStable();
        }
        await expectDisposed(container);
      });
    }

    it(`${kind} supports no backdrop and releases default scroll blocking on Escape`, async () => {
      const { fixture, owner, trigger, container } = await setup();
      owner.host.open(definition, { kind, options: { backdrop: false } }, { trigger });
      await fixture.whenStable();
      expect(container.querySelector('.cdk-overlay-backdrop')).toBeNull();
      const wheel = new Event('wheel', { bubbles: true, cancelable: true });
      trigger.dispatchEvent(wheel);
      expect(wheel.defaultPrevented).toBe(true);
      const inside = new Event('wheel', { bubbles: true, cancelable: true });
      container.querySelector('input')!.dispatchEvent(inside);
      expect(inside.defaultPrevented).toBe(false);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();
      await expectDisposed(container);
      const after = new Event('wheel', { bubbles: true, cancelable: true });
      trigger.dispatchEvent(after);
      expect(after.defaultPrevented).toBe(false);
    });

    it(`${kind} closes on feature destruction and rejects further openings`, async () => {
      const { fixture, owner, trigger, container } = await setup();
      owner.host.open(definition, { kind }, { trigger });
      fixture.destroy();
      await expectDisposed(container);
      expect(owner.host.open(definition, { kind }, { trigger })).toBeUndefined();
    });

    it(`${kind} rejects a disconnected opening trigger`, async () => {
      const { owner, trigger, container } = await setup();
      trigger.remove();
      expect(owner.host.open(definition, { kind }, { trigger })).toBeUndefined();
      expect(container.querySelector('.cdk-overlay-pane')).toBeNull();
    });
  }

  it('closes a popover on anchor removal but retains a dialog until its owner closes it', async () => {
    const { fixture, owner, trigger, container } = await setup();
    owner.host.open(definition, { kind: 'popover' }, { trigger });
    trigger.remove();
    await expectDisposed(container);
    const second = document.createElement('button');
    document.body.append(second);
    owner.lifetime.onDestroy(() => second.remove());
    owner.host.open(definition, { kind: 'dialog' }, { trigger: second });
    second.remove();
    await fixture.whenStable();
    expect(container.querySelector('.cdk-overlay-pane')).not.toBeNull();
    owner.host.close();
    await fixture.whenStable();
    await expectDisposed(container);
  });

  it('isolates two owners and dismisses only the newest overlay on Escape', async () => {
    const one = await setup();
    const two = await setup();
    one.owner.host.open(definition, { kind: 'popover' }, { trigger: one.trigger });
    two.owner.host.open(definition, { kind: 'dialog' }, { trigger: two.trigger });
    await two.fixture.whenStable();
    expect(two.container.textContent).toContain(one.owner.featureLabel);
    expect(two.container.textContent).toContain(two.owner.featureLabel);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await two.fixture.whenStable();
    await vi.waitFor(() =>
      expect(two.container.querySelectorAll('.cdk-overlay-pane')).toHaveLength(1),
    );
    one.fixture.destroy();
    await expectDisposed(two.container);
  });

  it('allows background scrolling in a configured popover', async () => {
    const { fixture, owner, trigger, container } = await setup();
    owner.host.open(definition, { kind: 'popover', options: { scrollable: true } }, { trigger });
    const wheel = new Event('wheel', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    owner.host.close();
    await fixture.whenStable();
    await expectDisposed(container);
  });

  it('clears its active state when Material closes the dialog externally', async () => {
    const { fixture, owner, trigger, container } = await setup();
    owner.host.open(definition, { kind: 'dialog' }, { trigger });
    TestBed.inject(MatDialog).closeAll();
    await fixture.whenStable();
    await expectDisposed(container);
    expect(owner.host.open(definition, { kind: 'popover' }, { trigger })).toBeDefined();
    owner.host.close();
    await expectDisposed(container);
  });

  for (const kind of ['popover', 'dialog'] as const) {
    it(`${kind} discards unsaved changes on backdrop click by default`, async () => {
      const { fixture, owner, trigger, container } = await setup();
      owner.host.open({ component: DirtyEditor, data: definition.data }, { kind }, { trigger });
      await fixture.whenStable();
      container.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
      await fixture.whenStable();
      await expectDisposed(container);
    });

    it(`${kind} keeps unsaved changes open with 'when-clean'; Escape still discards`, async () => {
      const { fixture, owner, trigger, container } = await setup();
      owner.host.open(
        { component: DirtyEditor, data: definition.data },
        { kind, options: { closeOnBackdropClick: 'when-clean' } },
        { trigger },
      );
      await fixture.whenStable();
      const backdrop = container.querySelector<HTMLElement>('.cdk-overlay-backdrop')!;
      backdrop.click();
      await fixture.whenStable();
      expect(container.querySelector('.cdk-overlay-pane')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();
      await expectDisposed(container);
    });

    it(`${kind} closes a clean editor on backdrop click with 'when-clean'`, async () => {
      const { fixture, owner, trigger, container } = await setup();
      owner.host.open(
        definition,
        { kind, options: { closeOnBackdropClick: 'when-clean' } },
        { trigger },
      );
      await fixture.whenStable();
      container.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
      await fixture.whenStable();
      await expectDisposed(container);
    });
  }

  it('delegates an augmented presentation kind to its registered adapter', async () => {
    const opened = vi.fn();
    const adapter: EditorPresentationAdapter<{ readonly side: 'start' | 'end' }> = {
      open: (request) => {
        opened(request.options, request.label);
        request.attach(() => undefined, new Subject<unknown>());
        request.addResource(() => opened('closed'));
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideEditorPresentations(() => ({ panel: adapter })),
        provideGridCellLabels({ editor: 'Éditeur' }),
      ],
    });
    const { owner, trigger } = await setup();
    const ref = owner.host.open(
      definition,
      { kind: 'panel', options: { side: 'end' } },
      { trigger },
    );
    expect(opened).toHaveBeenCalledWith({ side: 'end' }, 'Éditeur');
    expect(owner.host.active()).toBe(true);
    ref!.close();
    expect(opened).toHaveBeenLastCalledWith('closed');
    expect(owner.host.active()).toBe(false);
  });

  it('rejects a presentation kind without an adapter and stays usable', async () => {
    const { owner, trigger } = await setup();
    expect(() => owner.host.open(definition, { kind: 'panel' }, { trigger })).toThrow(
      'No editor presentation is registered for "panel".',
    );
    expect(owner.host.active()).toBe(false);
  });
});
