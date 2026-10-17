import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type Type } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface DialogFrameData {
  readonly title: string;
  /** Any editor; its `data` input receives `data`. */
  readonly component: Type<unknown>;
  readonly data: unknown;
}

/** Gives a hosted editor a dialog title; the editor itself is unaware of the dialog. */
@Component({
  selector: 'cells-dialog-frame',
  imports: [MatDialogModule, NgComponentOutlet],
  template: `
    <h2 mat-dialog-title>{{ frame.title }}</h2>
    <mat-dialog-content>
      <ng-container *ngComponentOutlet="frame.component; inputs: { data: frame.data }" />
    </mat-dialog-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogFrame {
  protected readonly frame = inject<DialogFrameData>(MAT_DIALOG_DATA);
}
