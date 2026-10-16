import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellEditAction } from './action';
import type { ActionState } from './action';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellEditAction],
  template: '<button [cellEditAction]="state()" (activated)="count = count + 1"></button>',
})
class Harness {
  readonly state = signal<ActionState>({
    visible: true,
    disabled: true,
    tooltip: 'Locked',
    label: 'Edit Amount',
  });
  count = 0;
}
describe('CellEditAction', () => {
  it('names the column, exposes a disabled reason and guards programmatic clicks as well as pointer clicks', async () => {
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.title).toBe('Locked');
    expect(button.getAttribute('aria-label')).toBe('Edit Amount');
    expect(button.hasAttribute('tabindex')).toBe(false);
    button.click();
    expect(fixture.componentInstance.count).toBe(0);
    fixture.componentInstance.state.set({
      visible: true,
      disabled: false,
      tooltip: 'Edit',
      label: 'Edit Amount',
    });
    await fixture.whenStable();
    button.click();
    expect(fixture.componentInstance.count).toBe(1);
    fixture.componentInstance.state.set({
      visible: false,
      disabled: false,
      tooltip: null,
      label: 'Edit Amount',
    });
    await fixture.whenStable();
    button.click();
    expect(fixture.componentInstance.count).toBe(1);
  });
});
