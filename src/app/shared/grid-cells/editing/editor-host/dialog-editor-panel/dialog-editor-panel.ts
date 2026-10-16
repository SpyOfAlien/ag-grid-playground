import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import { MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent } from '@angular/material/dialog';
@Component({
  selector: 'app-dialog-editor-panel',
  imports: [CdkPortalOutlet, MatDialogTitle, MatDialogContent],
  template: `@if (title) {
      <h2 mat-dialog-title>{{ title }}</h2>
    }
    <mat-dialog-content class="editor-body"><ng-template cdkPortalOutlet /></mat-dialog-content>`,
  styleUrl: './dialog-editor-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogEditorPanel {
  readonly title = inject<string | undefined>(MAT_DIALOG_DATA);

  readonly outlet = viewChild.required(CdkPortalOutlet);
}
