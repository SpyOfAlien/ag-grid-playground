import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { ValueEditorData } from '../cell-editor';
import type { HostedEditor } from '../editor-host/editor-host.model';
import { FieldEditor, type FieldEditorConfig } from './field-editor';

export interface TextareaEditorConfig extends FieldEditorConfig {
  readonly rows?: number;
  readonly maxLength?: number;
}

export type TextareaEditorData = ValueEditorData<string, TextareaEditorConfig>;

@Component({
  selector: 'app-textarea-editor',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-form-field appearance="outline">
        <mat-label>{{ data().config.label }}</mat-label>
        <textarea
          matInput
          formControlName="value"
          [readOnly]="saving()"
          [attr.aria-label]="data().config.label"
          [rows]="data().config.rows ?? 4"
          [attr.maxlength]="data().config.maxLength ?? null"
          [placeholder]="data().config.placeholder ?? ''"
        ></textarea>
        <mat-error>{{ labels.invalid }}</mat-error>
      </mat-form-field>
      <p role="alert">{{ error() }}</p>
      <div class="actions">
        <button mat-flat-button type="submit" [disabled]="!canSave()">
          {{ saving() ? labels.saving : labels.save }}
        </button>
        <button mat-button type="button" (click)="close()">{{ labels.cancel }}</button>
      </div>
    </form>
  `,
  styleUrl: './field-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextareaEditor
  extends FieldEditor<string, TextareaEditorConfig>
  implements HostedEditor<TextareaEditorData>
{
  protected override createControl(): FormControl<string> {
    return new FormControl('', { nonNullable: true });
  }

  protected override validators(config: TextareaEditorConfig): ValidatorFn[] {
    return config.maxLength === undefined ? [] : [Validators.maxLength(config.maxLength)];
  }
}
