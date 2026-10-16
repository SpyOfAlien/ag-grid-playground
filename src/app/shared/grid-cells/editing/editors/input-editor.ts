import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { ValueEditorData } from '../cell-editor';
import type { HostedEditor } from '../editor-host/editor-host.model';
import { FieldEditor, type FieldEditorConfig } from './field-editor';

export interface InputEditorConfig<V extends string | number> extends FieldEditorConfig {
  readonly mode: V extends number ? 'number' : 'text';
}

export type InputEditorData<V extends string | number> = ValueEditorData<
  V | null,
  InputEditorConfig<V>
>;

const finiteNumber: ValidatorFn = (control) =>
  control.value == null || (typeof control.value === 'number' && Number.isFinite(control.value))
    ? null
    : { finiteNumber: true };

@Component({
  selector: 'app-input-editor',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-form-field appearance="outline">
        <mat-label>{{ data().config.label }}</mat-label>
        @if (data().config.mode === 'number') {
          <input
            matInput
            type="number"
            formControlName="value"
            [readOnly]="saving()"
            [attr.aria-label]="data().config.label"
            [placeholder]="data().config.placeholder ?? ''"
          />
        } @else {
          <input
            matInput
            type="text"
            formControlName="value"
            [readOnly]="saving()"
            [attr.aria-label]="data().config.label"
            [placeholder]="data().config.placeholder ?? ''"
          />
        }
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
export class InputEditor<V extends string | number = string>
  extends FieldEditor<V | null, InputEditorConfig<V>>
  implements HostedEditor<InputEditorData<V>>
{
  protected override createControl(): FormControl<V | null> {
    return new FormControl<V | null>(null);
  }

  protected override validators(config: InputEditorConfig<V>): ValidatorFn[] {
    return config.mode === 'number' ? [finiteNumber] : [];
  }
}
