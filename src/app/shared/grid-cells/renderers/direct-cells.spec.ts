import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectionListHarness } from '@angular/material/list/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EditorRef, type EditorHostService } from '../editing/editor-host/public-api';
import { ToggleCell } from './toggle/toggle-cell';
import { DropdownCell } from './dropdown/dropdown-cell';
import { DropdownOptions } from './dropdown/dropdown-options';
import { DropdownOptionsEditor } from './dropdown/dropdown-options-editor';
import type { DropdownEditorData } from './dropdown/dropdown-editor-data.model';
import type { ToggleCellParams } from './toggle/toggle-cell-params.model';
import type { DropdownCellParams } from './dropdown/dropdown-cell-params.model';
import type { CellContext } from '../core/cell-context.model';
import { rendererParams } from '../../../../../test-utils/renderer-params';
interface Row {
  active: boolean;
  unit: string;
  locked: boolean;
}
const row: Row = { active: true, unit: 'kg', locked: false };

describe('Direct controls', () => {
  it('toggle saves once while pending, preserves committed appearance and retains its element on refresh', async () => {
    const fixture = TestBed.createComponent<ToggleCell<Row>>(ToggleCell);
    let finish!: () => void;
    const save = vi
      .fn<(value: boolean, cell: CellContext<Row, boolean>) => Promise<void>>()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const config = { toggle: { save } } satisfies ToggleCellParams<Row>;
    const params = rendererParams({ ...row }, true, config, {});
    params.colDef = { colId: 'active' };
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    button.click();
    await fixture.whenStable();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ rowId: 'row-1', columnId: 'active', value: true }),
    );
    expect(button.getAttribute('aria-checked')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    finish();
    await fixture.whenStable();
    params.value = false;
    expect(fixture.componentInstance.refresh(params)).toBe(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBe(button);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });

  it('toggle retains committed values after failure and guards denied or missing rows', async () => {
    const fixture = TestBed.createComponent<ToggleCell<Row>>(ToggleCell);
    const save = vi.fn().mockRejectedValue(new Error('Server failure'));
    const config = {
      toggle: {
        save,
        permission: ({ data }) =>
          data?.locked ? { allowed: false, reason: 'Locked' } : { allowed: true },
      },
    } satisfies ToggleCellParams<Row>;
    const params = rendererParams({ ...row }, true, config, {});
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    expect(button.title).toBe('Server failure');
    expect(button.getAttribute('aria-checked')).toBe('true');
    params.data!.locked = true;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect(button.title).toBe('Locked');
    button.click();
    expect(save).toHaveBeenCalledOnce();
    params.data = undefined;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    button.click();
    expect(save).toHaveBeenCalledOnce();
  });

  it('dropdown keeps one trigger, passes typed data and tracks expanded state without a close subscription', async () => {
    const fixture = TestBed.createComponent<DropdownCell<Row, string>>(DropdownCell);
    const active = signal(false);
    const handle = { close: () => active.set(false) };
    const open = vi.fn(() => {
      active.set(true);
      return handle;
    });
    const editorHost = {
      open,
      isOpen: (ref: EditorRef | undefined) => ref === handle && active(),
    } as unknown as EditorHostService;
    const save = vi.fn().mockResolvedValue(undefined);
    const config = {
      markers: { warning: { when: ({ data }) => data?.locked ?? false } },
      dropdown: {
        options: [{ value: 'kg', label: 'Kilograms' }],
        save,
        permission: ({ data }) =>
          data?.locked ? { allowed: false, reason: 'Locked' } : { allowed: true },
        popover: { backdrop: false, width: 220 },
      },
    } satisfies DropdownCellParams<Row, string>;
    const params = rendererParams({ ...row }, 'kg', config, { editorHost });
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector('button')!;
    expect(root.children.length).toBe(1);
    expect(root.querySelector('select')).toBeNull();
    button.click();
    button.click();
    await fixture.whenStable();
    expect(open).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const [definition, presentation, context] = open.mock.calls[0] as unknown as [
      { data: DropdownEditorData<string> },
      { kind: string; options: { backdrop: boolean; width: number } },
      { trigger: HTMLElement },
    ];
    expect(definition.data.initialValue).toBe('kg');
    expect(definition.data.options).toBe(config.dropdown.options);
    expect(presentation).toMatchObject({
      kind: 'popover',
      options: { backdrop: false, width: 220 },
    });
    expect(context.trigger).toBe(button);
    await definition.data.save('t');
    expect(save).toHaveBeenCalledWith('t', expect.objectContaining({ value: 'kg' }));
    handle.close();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    params.data!.locked = true;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect(root.querySelector('button')).toBe(button);
    expect(root.querySelector('.grid-cell-marker')).not.toBeNull();
    expect(button.title).toBe('Locked');
    button.click();
    expect(open).toHaveBeenCalledOnce();
  });
  it('options support object equality, empty selections, disabled options, and restore committed selection before emitting', async () => {
    const fixture = TestBed.createComponent<DropdownOptions<{ id: number }>>(DropdownOptions);
    fixture.componentRef.setInput('options', [
      { value: { id: 1 }, label: 'One' },
      { value: { id: 2 }, label: 'Two', disabled: true },
      { value: { id: 3 }, label: 'Three' },
    ]);
    fixture.componentRef.setInput(
      'equals',
      (a: { id: number }, b: { id: number }) => a.id === b.id,
    );
    fixture.componentRef.setInput('value', { id: 1 });
    await fixture.whenStable();
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    const list =
      await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectionListHarness);
    const options = await list.getItems();
    expect(await options[0].isSelected()).toBe(true);
    await options[1].select();
    expect(selected).not.toHaveBeenCalled();
    await options[2].select();
    expect(selected).toHaveBeenCalledWith({ id: 3 });
    expect(await options[0].isSelected()).toBe(true);
    expect(await options[2].isSelected()).toBe(false);
    fixture.componentRef.setInput('value', null);
    await fixture.whenStable();
    expect(await options[0].isSelected()).toBe(false);
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    await options[2].select();
    expect(selected).toHaveBeenCalledOnce();
  });

  it('dropdown editor rejects disabled/unchanged choices, guards pending repeats, and retries failure', async () => {
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: EditorRef, useValue: { close } }] });
    const fixture = TestBed.createComponent<DropdownOptionsEditor<string>>(DropdownOptionsEditor);
    let fail!: (error: Error) => void;
    const save = vi.fn<(value: string) => Promise<void>>().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    fixture.componentRef.setInput('data', {
      initialValue: 'kg',
      options: [
        { value: 'kg', label: 'kg' },
        { value: 't', label: 't' },
        { value: 'lb', label: 'lb', disabled: true },
      ],
      save,
    } satisfies DropdownEditorData<string>);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    await editor.choose('kg');
    await editor.choose('lb');
    expect(save).not.toHaveBeenCalled();
    const pending = editor.choose('t');
    await editor.choose('t');
    expect(save).toHaveBeenCalledOnce();
    fail(new Error('Rejected'));
    await pending;
    await fixture.whenStable();
    expect(editor.error()).toBe('Rejected');
    expect(close).not.toHaveBeenCalled();
    const list =
      await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectionListHarness);
    expect(await (await list.getItems())[0].isSelected()).toBe(true);
    save.mockResolvedValue();
    await editor.choose('t');
    expect(close).toHaveBeenCalledOnce();
    expect(save).toHaveBeenLastCalledWith('t');
  });
});
