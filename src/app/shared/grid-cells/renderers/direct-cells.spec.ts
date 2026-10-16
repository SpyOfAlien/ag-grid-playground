import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectionListHarness } from '@angular/material/list/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { EditorRef } from '../editing/editor-host/editor-ref';
import { CellOperations } from '../capabilities/save';
import type { EditorHostService } from '../editing/editor-host/editor-host-service';
import { ToggleCell, type ToggleCellParams } from './toggle-cell';
import { DropdownCell, type DropdownCellParams } from './dropdown-cell';
import { DropdownOptions } from './dropdown-options';
import { DropdownOptionsEditor } from './dropdown-options-editor';
import type { DropdownEditorData } from '../capabilities/dropdown';
import type { CellContext } from '../core/cell-context';
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

  it('dropdown editor rejects disabled choices, guards pending repeats, and retries failure', async () => {
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

  it('dropdown editor closes without saving when the committed value is chosen again', async () => {
    const close = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: EditorRef, useValue: { close } }] });
    const fixture = TestBed.createComponent<DropdownOptionsEditor<string>>(DropdownOptionsEditor);
    const save = vi.fn().mockResolvedValue(undefined);
    fixture.componentRef.setInput('data', {
      initialValue: 'kg',
      options: [
        { value: 'kg', label: 'kg' },
        { value: 't', label: 't' },
      ],
      save,
    } satisfies DropdownEditorData<string>);
    await fixture.whenStable();
    const list =
      await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectionListHarness);
    const [selected] = await list.getItems();
    await (await selected.host()).click();
    expect(close).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });

  it('toggle shows the denial reason even when content has its own tooltip', async () => {
    const fixture = TestBed.createComponent<ToggleCell<Row>>(ToggleCell);
    const config = {
      content: { tooltip: 'Content tip' },
      toggle: {
        save: () => Promise.reject(new Error('Server failure')),
        permission: ({ data }) =>
          data?.locked ? { allowed: false, reason: 'Locked' } : { allowed: true },
      },
    } satisfies ToggleCellParams<Row>;
    const params = rendererParams({ ...row, locked: true }, true, config, {});
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector('button')!;
    expect(button.title).toBe('Locked');
    expect(root.querySelector('.grid-cell-content')?.getAttribute('title')).toBe('Content tip');
    expect(button.hasAttribute('class') && button.classList.contains('grid-cell-content')).toBe(
      false,
    );
    params.data!.locked = false;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect(button.title).toBe('Content tip');
    button.click();
    await fixture.whenStable();
    expect(button.title).toBe('Server failure');
  });

  it('toggle announces failures and keeps a pending save across renderer recreation', async () => {
    const announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [CellOperations, { provide: LiveAnnouncer, useValue: { announce } }],
    });
    const cellOperations = TestBed.inject(CellOperations);
    let fail!: (error: Error) => void;
    const save = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const config = { toggle: { save } } satisfies ToggleCellParams<Row>;
    const create = async () => {
      const fixture = TestBed.createComponent<ToggleCell<Row>>(ToggleCell);
      const params = rendererParams({ ...row }, true, config, { cellOperations });
      params.colDef = { colId: 'active', headerName: 'Active' };
      fixture.componentInstance.agInit(params);
      await fixture.whenStable();
      return fixture;
    };
    const first = await create();
    (first.nativeElement as HTMLElement).querySelector('button')!.click();
    first.destroy();
    // The grid recycled the renderer while the save is still running.
    const second = await create();
    const button = (second.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Active');
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click();
    expect(save).toHaveBeenCalledOnce();
    fail(new Error('Rejected'));
    await vi.waitFor(() =>
      expect(cellOperations.state({ rowId: 'row-1', columnId: 'active' }).error).toBe('Rejected'),
    );
    await second.whenStable();
    expect(button.title).toBe('Rejected');
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(announce).toHaveBeenCalledWith('Rejected', 'assertive');
  });

  it('dropdown requires an editor host when the grid first renders it', () => {
    const fixture = TestBed.createComponent<DropdownCell<Row, string>>(DropdownCell);
    const config = {
      dropdown: { options: [{ value: 'kg', label: 'Kilograms' }], save: async () => undefined },
    } satisfies DropdownCellParams<Row, string>;
    expect(() =>
      fixture.componentInstance.agInit(rendererParams({ ...row }, 'kg', config, {})),
    ).toThrow('Provide editorHost in grid context.');
  });
});
