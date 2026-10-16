import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellEditAction } from './cell-edit-action';
import type { ActionState } from './action.model';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellEditAction],
  template: '<button [cellEditAction]="state()" (activated)="count = count + 1"></button>',
})
class Harness {
  readonly state = signal<ActionState>({ visible: true, disabled: true, tooltip: 'Locked' });
  count = 0;
}
describe('CellEditAction', () => {
  it('exposes a disabled reason and guards programmatic clicks as well as pointer clicks', async () => {
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.title).toBe('Locked');
    button.click();
    expect(fixture.componentInstance.count).toBe(0);
    fixture.componentInstance.state.set({ visible: true, disabled: false, tooltip: 'Edit' });
    await fixture.whenStable();
    button.click();
    expect(fixture.componentInstance.count).toBe(1);
    fixture.componentInstance.state.set({ visible: false, disabled: false, tooltip: null });
    await fixture.whenStable();
    button.click();
    expect(fixture.componentInstance.count).toBe(1);
  });
});
