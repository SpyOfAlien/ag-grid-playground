import type { EditorHostService } from '../editing/editor-host/public-api';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PopoverCell } from './popover/popover-cell';
import { DialogCell } from './dialog/dialog-cell';
import { InputEditor } from '../editing/editors/input/input-editor';
import type { InputEditorData } from '../editing/editors/input/input-editor-config.model';
import type { PopoverCellParams } from './popover/popover-cell-params.model';
import type { DialogCellParams } from './dialog/dialog-cell-params.model';
import type { GridContext } from '../core/grid-context.model';
import { rendererParams } from '../../../../../test-utils/renderer-params';
interface Row {
  name: string;
  locked: boolean;
}
type Config = InputEditorData<string>;
const definition = {
  component: InputEditor<string>,
  data: (cell) => ({
    initialValue: cell.value ?? null,
    config: { label: 'Name', mode: 'text' },
    save: async () => undefined,
  }),
} satisfies NonNullable<PopoverCellParams<Row, string, Config>['action']>['editor'];
function context() {
  const open = vi.fn().mockReturnValue({ close: vi.fn() });
  return {
    value: { editorHost: { open } as unknown as EditorHostService } satisfies GridContext,
    open,
  };
}
describe('Explicit editing renderers', () => {
  for (const component of [PopoverCell, DialogCell]) {
    it(`${component.name} displays numeric content without an editor or host when action is absent`, async () => {
      const fixture = TestBed.createComponent<
        | PopoverCell<Row, number, InputEditorData<number>>
        | DialogCell<Row, number, InputEditorData<number>>
      >(component);
      const config = {
        content: { number: { locale: 'en-US', decimals: 2, unit: 'kg' } },
      } satisfies PopoverCellParams<Row, number, InputEditorData<number>>;
      const row: Row = { name: 'Amount', locked: false };
      fixture.componentInstance.agInit(rendererParams(row, 5, config, {}));
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.grid-cell-content')?.textContent).toBe('5.00 kg');
      expect(root.querySelector('button')).toBeNull();
      expect(() => fixture.componentInstance.open(new MouseEvent('click'))).not.toThrow();
    });
  }
  for (const component of [PopoverCell, DialogCell]) {
    it(`${component.name} formats numbers and reacts to unit changes while editing the raw value`, async () => {
      const unit = signal<string | null>('kg');
      const unitRule = vi.fn(() => unit());
      const markerRule = vi.fn(() => true);
      const fixture = TestBed.createComponent<
        | PopoverCell<Row, number, InputEditorData<number>>
        | DialogCell<Row, number, InputEditorData<number>>
      >(component);
      const hosts = context();
      const config: PopoverCellParams<Row, number, InputEditorData<number>> = {
        markers: { info: { when: markerRule } },
        action: {
          editor: {
            component: InputEditor<number>,
            data: (cell) => ({
              initialValue: cell.value ?? null,
              config: { label: 'Amount', mode: 'number' },
              save: async () => undefined,
            }),
          },
        },
        content: {
          number: { locale: 'en-US', decimals: 2, useGrouping: true, unit: unitRule },
        },
      };
      const params = rendererParams({ name: 'Amount', locked: false }, 1250.5, config, hosts.value);
      params.valueFormatted = 'Grid formatted';
      fixture.componentInstance.agInit(params);
      const refresh = vi.spyOn(fixture.componentInstance, 'refresh');
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const content = root.querySelector('.grid-cell-content');
      expect(content?.textContent).toBe('1,250.50 kg');
      markerRule.mockClear();
      unit.set('lb');
      await fixture.whenStable();
      expect(content?.textContent).toBe('1,250.50 lb');
      expect(root.querySelector('.grid-cell-content')).toBe(content);
      expect(markerRule).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      root.querySelector('button')!.click();
      expect(hosts.open.mock.calls[0][0]).toMatchObject({ data: { initialValue: 1250.5 } });

      params.content!.number = { ...params.content!.number, locale: 'de-DE', useGrouping: false };
      fixture.componentInstance.refresh(params);
      await fixture.whenStable();
      expect(content?.textContent).toBe('1250,50 lb');
      unit.set(null);
      await fixture.whenStable();
      expect(content?.textContent).toBe('1250,50');
      params.value = 0;
      fixture.componentInstance.refresh(params);
      await fixture.whenStable();
      expect(content?.textContent).toBe('0,00');
      for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
        unitRule.mockClear();
        params.value = value;
        fixture.componentInstance.refresh(params);
        await fixture.whenStable();
        expect(content?.textContent).toBe('');
        expect(unitRule).not.toHaveBeenCalled();
      }
    });
  }
  it('PopoverCell retains its content on refresh and opens only the popover host with resolved options', async () => {
    const fixture = TestBed.createComponent<PopoverCell<Row, string, Config>>(PopoverCell);
    const hosts = context();
    const config = {
      content: {
        tooltip: ({ data }) => data?.name ?? null,
        text: ({ value }) => (value == null ? '' : value.toUpperCase()),
      },
      markers: { info: { when: true, tooltip: 'Info' } },
      action: {
        permission: ({ data }) =>
          data?.locked ? { allowed: false, reason: 'Locked' } : { allowed: true },

        editor: {
          ...definition,
          popover: ({ trigger }) => ({ anchor: { kind: 'element', element: trigger }, width: 320 }),
        },
      },
    } satisfies PopoverCellParams<Row, string, Config>;
    const params = rendererParams({ name: 'First', locked: true }, 'hello', config, hosts.value);
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.children.length).toBe(3);
    expect(root.querySelector('app-input-editor')).toBeNull();
    const content = root.querySelector('.grid-cell-content');
    const button = root.querySelector('button')!;
    button.click();
    expect(hosts.open).not.toHaveBeenCalled();
    expect(button.title).toBe('Locked');
    params.data!.locked = false;
    params.data!.name = 'Next';
    expect(fixture.componentInstance.refresh(params)).toBe(true);
    await fixture.whenStable();
    expect(root.querySelector('.grid-cell-content')).toBe(content);
    expect(content?.textContent).toBe('HELLO');
    expect(content?.getAttribute('title')).toBe('Next');
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 10, clientY: 20 }),
    );
    expect(hosts.open).toHaveBeenCalledOnce();
    expect(hosts.open.mock.calls[0][0]).toMatchObject({
      component: InputEditor,
      data: { initialValue: 'hello' },
    });
    expect(hosts.open.mock.calls[0][1]).toMatchObject({
      kind: 'popover',
      options: { width: 320, anchor: { kind: 'element', element: button } },
    });
    expect(hosts.open.mock.calls[0][2]).toEqual({ trigger: button });
  });
  it('uses current nested options and value after refresh while preserving a custom anchor', async () => {
    const fixture = TestBed.createComponent<PopoverCell<Row, string, Config>>(PopoverCell);
    const hosts = context();
    const config: PopoverCellParams<Row, string, Config> = {
      action: {
        editor: { ...definition, popover: { width: 200 } },
      },
    };
    const params = rendererParams({ name: 'First', locked: false }, 'First', config, hosts.value);
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector('button')!;
    button.click();
    expect(hosts.open.mock.calls[0][1]).toEqual({ kind: 'popover', options: { width: 200 } });

    const anchor = document.createElement('button');
    params.value = 'Updated';
    params.action!.editor = {
      ...definition,
      popover: ({ trigger, value }) => ({
        anchor: { kind: 'element', element: anchor },
        width: trigger === button && value === 'Updated' ? 440 : 200,
      }),
    };
    expect(fixture.componentInstance.refresh(params)).toBe(true);
    await fixture.whenStable();
    expect(root.querySelector('button')).toBe(button);
    button.click();
    expect(hosts.open.mock.calls[1][0]).toMatchObject({ data: { initialValue: 'Updated' } });
    expect(hosts.open.mock.calls[1][1]).toEqual({
      kind: 'popover',
      options: { width: 440, anchor: { kind: 'element', element: anchor } },
    });
    expect(hosts.open.mock.calls[1][2]).toEqual({ trigger: button });
  });

  it('DialogCell opens only its dialog host, passes configured dimensions, and hides the pen for display-only configs', async () => {
    const fixture = TestBed.createComponent<DialogCell<Row, string, Config>>(DialogCell);
    const hosts = context();
    const config = {
      action: {
        tooltip: 'Edit dialog',

        editor: { ...definition, dialog: { title: 'Editor', width: 400, height: 500 } },
      },
    } satisfies DialogCellParams<Row, string, Config>;
    const params = rendererParams({ name: 'Hello', locked: false }, 'Hello', config, hosts.value);
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector('button')!.click();
    expect(hosts.open).toHaveBeenCalledOnce();
    expect(hosts.open.mock.calls[0][1]).toMatchObject({
      kind: 'dialog',
      options: config.action.editor.dialog,
    });
    fixture.componentInstance.refresh({ ...params, action: undefined, value: null });
    await fixture.whenStable();
    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('.grid-cell-content')?.textContent).toBe('');
  });
});
