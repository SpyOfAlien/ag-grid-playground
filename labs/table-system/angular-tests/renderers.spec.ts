import { TestBed } from '@angular/core/testing';
import { ICellRendererParams } from 'ag-grid-community';
import {
  ReviewCell,
  ReviewContext,
} from '../../../src/app/features/table-system-lab/cells/review-cell';
import { TableModel } from '../../../src/app/shared/table-system/model/table-model';
import { OperationController } from '../../../src/app/shared/table-system/operations/operation-controller';
import {
  fixtures,
  LabRow,
  validateRow,
} from '../../../src/app/features/table-system-lab/domain/lab-row';
import { createReviewOperation } from '../../../src/app/features/table-system-lab/domain/lab-operations';
import { SimulatedServer } from '../../../src/app/features/table-system-lab/persistence/simulated-server';
it('group, pinned aggregate and unavailable cells never acquire editing bindings', () => {
  const model = new TableModel('lab', fixtures(2), validateRow);
  const server = new SimulatedServer();
  const context = {
    controller: new OperationController(model),
    review: createReviewOperation(server),
  };
  const view = TestBed.createComponent(ReviewCell);
  for (const node of [{ group: true }, { rowPinned: 'top' }, {}]) {
    const params = {
      data: node.group || node.rowPinned ? model.rows()[0] : undefined,
      node,
      context,
    } as unknown as ICellRendererParams<LabRow, boolean, ReviewContext>;
    view.componentInstance.agInit(params);
    view.detectChanges();
    expect(view.nativeElement.querySelector('button')).toBeNull();
  }
  expect(server.submissions()).toBe(0);
  view.destroy();
});
