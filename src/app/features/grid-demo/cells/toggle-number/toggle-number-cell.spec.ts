import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ToggleNumberCell } from './toggle-number-cell';
import type { ToggleNumberCellParams } from './toggle-number-cell-params.model';
import { InputEditor } from '../../../../shared/grid-cells/editing/editors/input/input-editor';
import type { InputEditorData } from '../../../../shared/grid-cells/editing/editors/input/input-editor-config.model';
import type { EditorHostService } from '../../../../shared/grid-cells/editing/editor-host/public-api';
import { rendererParams } from '../../../../../../test-utils/renderer-params';
interface Row {
  amount: number | null;
  active: boolean;
  unit: string;
}
type Config = InputEditorData<number>;
function setup(value: number | null = 0) {
  const fixture = TestBed.createComponent<ToggleNumberCell<Row, Config>>(ToggleNumberCell);
  const submit = vi
    .fn<
      (
        value: boolean,
        cell: import('../../../../shared/grid-cells/core/cell-context.model').CellContext<
          Row,
          number
        >,
      ) => Promise<void>
    >()
    .mockResolvedValue();
  const open = vi.fn().mockReturnValue({ close: vi.fn() });
  const permission = ({ data }: { data: Readonly<Row> | undefined }) =>
    data?.active ? { allowed: true as const } : { allowed: false as const, reason: 'Enable first' };
  const config = {
    content: {
      alignment: 'end',
      disabled: ({ data }) => !data?.active,

      number: { decimals: 2, unit: ({ data }) => data?.unit ?? null },
    },
    markers: { warning: { when: ({ data }) => !data?.active, tooltip: 'Inactive' } },
    toggle: {
      permission: { allowed: true },
      checked: ({ data }) => data?.active ?? false,
      save: submit,
    },
    action: {
      permission,
      tooltip: 'Edit amount',

      editor: {
        component: InputEditor<number>,
        data: (cell) => ({
          initialValue: cell.value ?? null,
          config: { label: 'Amount', mode: 'number' },
          save: async () => undefined,
        }),

        popover: ({ trigger }) => ({ anchor: { kind: 'element', element: trigger }, width: 320 }),
      },
    },
  } satisfies ToggleNumberCellParams<Row>;
  const params = rendererParams({ amount: value, active: true, unit: 'kg' }, value, config, {
    editorHost: { open } as unknown as EditorHostService,
  });
  params.colDef = { ...params.colDef, colId: 'amount' };
  fixture.componentInstance.agInit(params);
  return { fixture, params, submit, open };
}
describe('ToggleNumberCell composition', () => {
  it('evaluates shared content rules once and updates signals without refreshing', async () => {
    const { fixture, params } = setup();
    const disabled = signal(false);
    const disabledRule = vi.fn(() => disabled());
    params.content.disabled = disabledRule;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const content = root.querySelector('span.grid-cell-content');
    expect(disabledRule).toHaveBeenCalledOnce();
    disabledRule.mockClear();
    disabled.set(true);
    await fixture.whenStable();
    expect(disabledRule).toHaveBeenCalledOnce();
    expect(root.querySelector('span.grid-cell-content')).toBe(content);
    expect(content?.classList.contains('grid-cell-muted')).toBe(true);
    expect(content?.textContent).toBe('0.00 kg');
  });
  it('retains both content controls and amount while a metadata-only refresh changes marker and editability', async () => {
    const { fixture, params, open } = setup();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const content = root.querySelector('.composite-content')!;
    const toggle = content.querySelector('button')!;
    const number = content.querySelector('span')!;
    const pen = root.querySelector<HTMLButtonElement>('.grid-cell-action')!;
    expect(root.children.length).toBe(2);
    expect(content.children.length).toBe(2);
    expect(number.textContent).toBe('0.00 kg');
    expect(root.querySelector('app-toggle-cell,app-number-cell')).toBeNull();
    pen.click();
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][0]).toMatchObject({
      component: InputEditor,
      data: { initialValue: 0 },
    });
    expect(open.mock.calls[0][1]).toMatchObject({
      kind: 'popover',
      options: { anchor: { kind: 'element', element: pen } },
    });
    params.data!.active = false;
    expect(fixture.componentInstance.refresh(params)).toBe(true);
    await fixture.whenStable();
    expect(root.querySelector('.composite-content')).toBe(content);
    expect(content.querySelector('button')).toBe(toggle);
    expect(content.querySelector('span')).toBe(number);
    expect(number.textContent).toBe('0.00 kg');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(pen.title).toBe('Enable first');
    pen.click();
    expect(open).toHaveBeenCalledOnce();
    expect(root.querySelector('.grid-cell-marker')).not.toBeNull();
    params.data!.active = true;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    pen.click();
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('direct toggle calls its configured save and guards the toggle/pen while pending', async () => {
    const { fixture, submit, open } = setup(1234.5);
    let finish!: () => void;
    submit.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.toggle')!;
    const pen = root.querySelector<HTMLButtonElement>('.grid-cell-action')!;
    toggle.click();
    toggle.click();
    await fixture.whenStable();
    pen.click();
    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ rowId: 'row-1', columnId: 'amount', value: 1234.5 }),
    );
    expect(open).not.toHaveBeenCalled();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('span.grid-cell-content')!.textContent).toBe('1,234.50 kg');
    finish();
    await fixture.whenStable();
    expect(fixture.componentInstance.saving()).toBe(false);
  });
  it('omits number and unit text for empty values and leaves committed state intact after failure', async () => {
    const { fixture, submit } = setup(null);
    submit.mockRejectedValue(new Error('Rejected'));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.toggle')!;
    expect(root.querySelector('span.grid-cell-content')!.textContent).toBe('');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.title).toBe('Rejected');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});
