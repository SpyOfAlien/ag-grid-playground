import { TestBed } from '@angular/core/testing';
import { ChoiceControl } from '../../../src/app/shared/table-system/renderers/choice-control';
it('supports object equality, disabled choices and pessimistic selection', () => {
  const view = TestBed.createComponent(ChoiceControl<{ id: number }>);
  const choices = [
    { value: { id: 1 }, label: 'One' },
    { value: { id: 2 }, label: 'Two', disabled: true },
    { value: { id: 3 }, label: 'Three' },
  ];
  view.componentRef.setInput('choices', choices);
  view.componentRef.setInput('value', { id: 1 });
  view.componentRef.setInput('equals', (a: { id: number }, b: { id: number }) => a.id === b.id);
  view.componentRef.setInput('label', 'Object choice');
  view.detectChanges();
  const selected: { id: number }[] = [];
  view.componentInstance.selection.subscribe((value) => selected.push(value));
  const select: HTMLSelectElement = view.nativeElement.querySelector('select');
  expect(select.value).toBe('0');
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  expect(selected).toHaveLength(0);
  select.value = '2';
  select.dispatchEvent(new Event('change'));
  expect(selected).toEqual([{ id: 3 }]);
  expect(select.value).toBe('0');
  view.componentRef.setInput('value', { id: 9 });
  view.detectChanges();
  expect(select.value).toBe('-1');
  view.destroy();
});
