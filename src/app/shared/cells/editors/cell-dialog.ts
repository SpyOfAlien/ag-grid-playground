import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type Type } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface CellDialogData {
  readonly title: string;
  /** Any editor; its `data` input receives `data`. */
  readonly component: Type<unknown>;
  readonly data: unknown;
}

/** Gives a hosted editor a dialog title; the editor itself is unaware of the dialog. */
@Component({
  selector: 'cells-dialog',
  imports: [MatDialogModule, NgComponentOutlet],
  template: `
    <h2 mat-dialog-title>{{ editor.title }}</h2>
    <mat-dialog-content>
      <ng-container *ngComponentOutlet="editor.component; inputs: { data: editor.data }" />
    </mat-dialog-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellDialog {
  protected readonly editor = inject<CellDialogData>(MAT_DIALOG_DATA);
}
