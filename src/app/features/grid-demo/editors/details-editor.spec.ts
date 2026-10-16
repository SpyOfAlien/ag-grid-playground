import { TestBed } from '@angular/core/testing';
import { EditorRef } from '@grid-cells';
import { DEMO_TABLE_PERSISTENCE } from '../demo-persistence.model';
import { DemoTableState } from '../demo-table-state';
import { DetailsEditor } from './details-editor';
import type { DetailsEditorData } from './details-editor-data.model';
import type { EditCommand } from '@grid-cells';
import type { DemoDetailsEdit } from '../demo-persistence.model';

describe('DetailsEditor', () => {
  function setup() {
    const saveDetails = vi
      .fn<(command: EditCommand<DemoDetailsEdit>) => Promise<void>>()
      .mockResolvedValue();
    const approveDetails = vi
      .fn<(command: EditCommand<DemoDetailsEdit>) => Promise<void>>()
      .mockResolvedValue();
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        DemoTableState,
        { provide: DEMO_TABLE_PERSISTENCE, useValue: { saveDetails, approveDetails } },
        { provide: EditorRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(DetailsEditor);
    const data: DetailsEditorData = {
      cell: { rowId: 'one', columnId: 'details' },
      initialValue: { name: 'Original', notes: 'Notes', amount: 0, revision: 7 },
      queryParams: { source: 'details', include: ['totals'] },
    };
    fixture.componentRef.setInput('data', data);
    return { fixture, data, saveDetails, approveDetails, close };
  }

  it('initializes a private form and passes the draft/revision through the explicit save action', async () => {
    const { fixture, data, saveDetails, approveDetails, close } = setup();
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(editor.form.getRawValue()).toEqual({ name: 'Original', notes: 'Notes', amount: 0 });
    expect(editor.dirty()).toBe(false);
    editor.form.setValue({ name: 'Draft', notes: 'Edited', amount: 2.5 });
    expect(editor.dirty()).toBe(true);
    await editor.submit(false);
    expect(saveDetails).toHaveBeenCalledWith({
      cell: data.cell,
      data: { name: 'Draft', notes: 'Edited', amount: 2.5, revision: 7 },
      queryParams: data.queryParams,
    });
    expect(approveDetails).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(data.initialValue.name).toBe('Original');
  });

  it('owns complex validation and uses the distinct approval action', async () => {
    const { fixture, approveDetails, close } = setup();
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.form.controls.name.setValue('  ');
    await editor.submit(true);
    expect(approveDetails).not.toHaveBeenCalled();
    editor.form.controls.name.setValue('Approved');
    editor.form.controls.amount.setValue(Infinity);
    await editor.submit(true);
    expect(approveDetails).not.toHaveBeenCalled();
    editor.form.controls.amount.setValue(0);
    await editor.submit(true);
    expect(approveDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Approved', amount: 0, revision: 7 }),
      }),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('guards duplicate actions while pending, retains a rejected draft, and permits retry', async () => {
    const { fixture, saveDetails, approveDetails, close } = setup();
    let reject!: (error: Error) => void;
    saveDetails.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.form.controls.name.setValue('Retry draft');
    const pending = editor.submit(false);
    await editor.submit(true);
    expect(approveDetails).not.toHaveBeenCalled();
    reject(new Error('Revision conflict'));
    await pending;
    expect(close).not.toHaveBeenCalled();
    expect(editor.error()).toBe('Revision conflict');
    expect(editor.form.controls.name.value).toBe('Retry draft');
    await editor.submit(false);
    expect(close).toHaveBeenCalledOnce();
  });
});
