import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { EditorHostService } from '../editing/editor-host/editor-host-service';
import { TestBed } from '@angular/core/testing';
import { NumberCell, type NumberCellParams } from './number-cell';
import { EditCell, type EditCellParams } from './edit-cell';
import { InputEditor, type InputEditorData } from '../editing/editors/input-editor';
import { rendererParams } from '../../../../../test-utils/renderer-params';

interface Row {
  unit: string;
}

@Component({
  imports: [NumberCell],
  providers: [EditorHostService],
  template: '<app-number-cell />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RendererOwner {
  readonly editorHost = inject(EditorHostService);

  readonly cell = viewChild.required<NumberCell<Row>>(NumberCell);

  readonly context = { editorHost: this.editorHost };
}

describe('Signal-driven renderer presentation', () => {
  it('updates content and markers independently without refreshing or replacing elements', async () => {
    const unit = signal('kg');
    const warning = signal(false);
    const unitRule = vi.fn(() => unit());
    const warningRule = vi.fn(() => warning());
    const config: NumberCellParams<Row> = {
      markers: { warning: { when: warningRule }, info: { when: true } },
      content: {
        number: { decimals: 2, unit: unitRule },
      },
    };
    const fixture = TestBed.createComponent<NumberCell<Row>>(NumberCell);
    const renderer = fixture.componentInstance;
    renderer.agInit(rendererParams({ unit: 'kg' }, 125, config, {}));
    const refresh = vi.spyOn(renderer, 'refresh');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const content = root.querySelector('.grid-cell-content');
    const marker = root.querySelector('.grid-cell-marker');
    unitRule.mockClear();
    warningRule.mockClear();

    unit.set('t');
    await fixture.whenStable();
    expect(content?.textContent).toBe('125.00 t');
    expect(root.querySelector('.grid-cell-content')).toBe(content);
    expect(root.querySelector('.grid-cell-marker')).toBe(marker);
    expect(unitRule).toHaveBeenCalledOnce();
    expect(warningRule).not.toHaveBeenCalled();

    unitRule.mockClear();
    warning.set(true);
    await fixture.whenStable();
    expect(marker?.getAttribute('data-kind')).toBe('warning');
    expect(warningRule).toHaveBeenCalledOnce();
    expect(unitRule).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('tracks conditional dependencies and reads current settings when empty content gains a value', async () => {
    const showUnits = signal(false);
    const unit = signal('kg');
    const rule = vi.fn(() => (showUnits() ? unit() : null));
    const config: NumberCellParams<Row> = {
      content: {
        number: { decimals: 2, unit: rule },
      },
    };
    const fixture = TestBed.createComponent<NumberCell<Row>>(NumberCell);
    const params = rendererParams({ unit: 'kg' }, 0, config, {});
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const content = root.querySelector('.grid-cell-content');
    rule.mockClear();
    unit.set('t');
    await fixture.whenStable();
    expect(rule).not.toHaveBeenCalled();
    expect(content?.textContent).toBe('0.00');
    showUnits.set(true);
    await fixture.whenStable();
    expect(content?.textContent).toBe('0.00 t');

    params.value = null;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    rule.mockClear();
    unit.set('lb');
    await fixture.whenStable();
    expect(content?.textContent).toBe('');
    expect(rule).not.toHaveBeenCalled();
    params.value = 0;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect(content?.textContent).toBe('0.00 lb');
    expect(root.querySelector('.grid-cell-content')).toBe(content);
  });

  it('updates action permission and disabled reasons through an application signal', async () => {
    const allowed = signal(true);
    const config = {
      action: {
        permission: () => (allowed() ? { allowed: true } : { allowed: false, reason: 'Read only' }),

        editor: {
          component: InputEditor<string>,
          data: () => ({
            initialValue: 'Example',
            config: { label: 'Name', mode: 'text' },
            save: async () => undefined,
          }),
        },
      },
    } satisfies EditCellParams<Row, string, InputEditorData<string>>;
    const fixture =
      TestBed.createComponent<EditCell<Row, string, InputEditorData<string>>>(EditCell);
    const open = vi.fn();
    const editorHost = {} as EditorHostService;
    fixture.componentInstance.agInit(
      rendererParams({ unit: 'kg' }, 'Example', config, { editorHost }),
    );
    fixture.componentInstance.open = open;
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector('button')!;
    allowed.set(false);
    await fixture.whenStable();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.title).toBe('Read only');
    button.click();
    expect(open).not.toHaveBeenCalled();
    allowed.set(true);
    await fixture.whenStable();
    expect(root.querySelector('button')).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('false');
    button.click();
    expect(open).toHaveBeenCalledOnce();
  });

  it('shares settings across live owners and releases destroyed renderers', async () => {
    const unit = signal('kg');
    const rule = vi.fn(() => unit());
    const config: NumberCellParams<Row> = {
      content: {
        number: { decimals: 2, unit: rule },
      },
    };
    const one = TestBed.createComponent(RendererOwner);
    const two = TestBed.createComponent(RendererOwner);
    await one.whenStable();
    await two.whenStable();
    const contextOne = one.componentInstance.context;
    const contextTwo = two.componentInstance.context;
    expect(contextOne.editorHost).not.toBe(contextTwo.editorHost);
    one.componentInstance.cell().agInit(rendererParams({ unit: 'kg' }, 1, config, contextOne));
    two.componentInstance.cell().agInit(rendererParams({ unit: 'kg' }, 2, config, contextTwo));
    await one.whenStable();
    await two.whenStable();
    unit.set('t');
    await one.whenStable();
    await two.whenStable();
    expect((one.nativeElement as HTMLElement).textContent).toBe('1.00 t');
    expect((two.nativeElement as HTMLElement).textContent).toBe('2.00 t');
    one.destroy();
    rule.mockClear();
    unit.set('lb');
    await two.whenStable();
    expect(rule).toHaveBeenCalledOnce();
    const recreated = TestBed.createComponent(RendererOwner);
    await recreated.whenStable();
    recreated.componentInstance
      .cell()
      .agInit(rendererParams({ unit: 'kg' }, 3, config, recreated.componentInstance.context));
    await recreated.whenStable();
    expect((recreated.nativeElement as HTMLElement).textContent).toBe('3.00 lb');
    expect(contextOne).not.toBe(contextTwo);
  });
});
