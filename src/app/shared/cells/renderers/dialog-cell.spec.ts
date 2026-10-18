import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CellEditor, EditorData } from '../editors/editor';
import {
  FakePersistence,
  rendererParams,
  settle,
  testSession,
  type Item,
} from '../testing/cell-test-kit';
import { DialogCell, type DialogCellParams } from './dialog-cell';

type NotesData = EditorData<Item, string>;

@Component({
  selector: 'cells-test-notes-editor',
  template: `<button type="button" class="probe-save" (click)="save()">Save</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NotesEditor implements CellEditor<NotesData> {
  readonly data = input.required<NotesData>();

  // A real editor shows the error; the probe only needs to survive it.
  protected save(): void {
    this.data()
      .submit('Updated')
      .catch(() => undefined);
  }
}

async function openDialog(persistence: FakePersistence) {
  const session = testSession(persistence);
  await session.run({ method: 'load' });
  const config: DialogCellParams<NotesData, FakePersistence> = {
    action: {
      editor: { component: NotesEditor },
      dialog: { title: 'Edit notes', width: 480 },
    },
  };
  const fixture = TestBed.createComponent(DialogCell<NotesData, FakePersistence>);
  fixture.componentInstance.agInit(
    rendererParams(session, config, 'Old', {
      columnId: 'name',
      field: 'name',
      headerName: 'Notes',
    }),
  );
  await fixture.whenStable();
  (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.cells-pen')!.click();
  await settle(fixture);
  return fixture;
}

const dialog = () => document.querySelector('mat-dialog-container');

describe('DialogCell', () => {
  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove()),
  );

  it('opens the editor in a titled dialog and closes it after saving', async () => {
    const persistence = new FakePersistence();
    const fixture = await openDialog(persistence);
    expect(dialog()?.querySelector('h2')?.textContent?.trim()).toBe('Edit notes');

    dialog()!.querySelector<HTMLButtonElement>('.probe-save')!.click();
    await settle(fixture);

    expect(persistence.saved[0]?.changes).toEqual([
      { rowId: 'A-1', field: 'name', value: 'Updated' },
    ]);
    await vi.waitFor(() => expect(dialog()).toBeNull());
  });

  it('stays open when the save fails', async () => {
    const persistence = new FakePersistence();
    persistence.next = () => Promise.reject(new Error('Server rejected'));
    const fixture = await openDialog(persistence);

    dialog()!.querySelector<HTMLButtonElement>('.probe-save')!.click();
    await settle(fixture);

    expect(persistence.saved).toHaveLength(1);
    expect(dialog()).not.toBeNull();
  });
});
