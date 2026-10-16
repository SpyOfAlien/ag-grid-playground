import { TestBed } from '@angular/core/testing';
import { ActionPreviewCell } from './action-preview-cell';
import { rendererParams } from '../../../../../test-utils/renderer-params';
import { createDemoRows } from '../demo-fixtures';
import type { ActionPreviewParams } from './action-preview-cell';
import type { DemoGridContext } from '../demo-grid-context.model';
describe('ActionPreviewCell', () => {
  it('uses three direct child elements and prevents a denied action from reaching table context', async () => {
    const fixture = TestBed.createComponent(ActionPreviewCell);
    const submit = vi.fn(async () => undefined);
    const context: DemoGridContext = { demoPersistenceMode: 'client' };
    const config: ActionPreviewParams = {
      save: submit,
      markers: { info: { when: true } },
      action: { permission: { allowed: false, reason: 'Locked' } },
    };
    const params = rendererParams(createDemoRows(1)[0], 'Reviewed', config, context);
    params.colDef = { colId: 'review' };
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(Array.from(host.children, (element) => element.tagName)).toEqual([
      'SPAN',
      'SPAN',
      'BUTTON',
    ]);
    host.querySelector('button')!.click();
    expect(submit).not.toHaveBeenCalled();
    params.action!.permission = { allowed: true };
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    host.querySelector('button')!.click();
    expect(submit).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ rowId: 'row-1', columnId: 'review' }),
    );
  });
});
