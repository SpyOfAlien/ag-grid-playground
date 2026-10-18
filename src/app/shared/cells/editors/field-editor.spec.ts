import { TestBed } from '@angular/core/testing';
import { Validators } from '@angular/forms';
import { ITEM, settle, type Item } from '../testing/cell-test-kit';
import type { CellSession } from '../grid/cell-grid-options';
import { FieldEditor, type FieldEditorData } from './field-editor';

function editor<V extends string | number>(
  extra: Pick<FieldEditorData<Item, V>, 'label' | 'mode' | 'validators'>,
  value: V | null,
  submit: (next: V | null) => Promise<void> = () => Promise.resolve(),
) {
  const calls = { submitted: [] as (V | null)[], closed: 0 };
  const fixture = TestBed.createComponent(FieldEditor<Item, V>);
  fixture.componentRef.setInput('data', {
    ...extra,
    value,
    row: ITEM,
    session: {} as CellSession,
    submit: (next: V | null) => {
      calls.submitted.push(next);
      return submit(next);
    },
    close: () => calls.closed++,
  } satisfies FieldEditorData<Item, V>);
  const host = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === text)!;
  return { fixture, host, calls, button };
}

function type(field: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  field.value = text;
  field.dispatchEvent(new Event('input'));
}

describe('FieldEditor', () => {
  it('starts from the value, refuses invalid text and submits valid text', async () => {
    const { fixture, host, calls, button } = editor<string>(
      { label: 'Name', mode: 'text', validators: [Validators.required] },
      'Bolt',
    );
    await fixture.whenStable();
    const input = host.querySelector('input')!;
    expect(input.value).toBe('Bolt');

    type(input, '');
    button('Save').click();
    await settle(fixture);
    expect(calls.submitted).toEqual([]);

    type(input, 'Hex bolt');
    button('Save').click();
    await settle(fixture);
    expect(calls.submitted).toEqual(['Hex bolt']);

    button('Cancel').click();
    expect(calls.closed).toBe(1);
  });

  it('shows saving, then the error, and stays open when the save fails', async () => {
    let fail!: (error: Error) => void;
    const { fixture, host, calls, button } = editor<number>(
      { label: 'Quantity', mode: 'number' },
      5,
      () => new Promise((_resolve, reject) => (fail = reject)),
    );
    await fixture.whenStable();
    type(host.querySelector('input')!, '12');

    button('Save').click();
    await fixture.whenStable();
    // Stays focusable while saving, so keyboard focus is not dropped; a second press does nothing.
    expect(button('Saving…').disabled).toBe(false);
    expect(button('Saving…').getAttribute('aria-disabled')).toBe('true');
    button('Saving…').click();
    await fixture.whenStable();
    expect(calls.submitted).toEqual([12]);

    fail(new Error('Exceeds capacity'));
    await settle(fixture);
    expect(host.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Exceeds capacity');
    expect(button('Save').getAttribute('aria-disabled')).not.toBe('true');
    expect(calls.closed).toBe(0);
  });

  it('uses a textarea for multi-line text', async () => {
    const { fixture, host } = editor<string>({ label: 'Notes', mode: 'multiline' }, 'Line 1');
    await fixture.whenStable();

    expect(host.querySelector('textarea')?.value).toBe('Line 1');
  });
});
