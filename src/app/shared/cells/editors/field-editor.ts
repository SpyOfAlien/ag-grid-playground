import { ChangeDetectionStrategy, Component, input, signal, type OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { CellEditor, EditorData } from './editor';

export type FieldEditorData<Row, V extends string | number> = EditorData<Row, V, V | null> & {
  readonly label: string;
  readonly mode: V extends number ? 'number' : 'text' | 'multiline';
  readonly validators?: readonly ValidatorFn[];
};

/** A single text, number or multi-line field with Save and Cancel. */
@Component({
  selector: 'cells-field-editor',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form class="cells-field-editor" (submit)="$event.preventDefault(); save()">
      <mat-form-field appearance="outline">
        <mat-label>{{ data().label }}</mat-label>
        @switch (data().mode) {
          @case ('multiline') {
            <textarea matInput rows="5" [formControl]="control" [readOnly]="saving()"></textarea>
          }
          @case ('number') {
            <input matInput type="number" [formControl]="control" [readOnly]="saving()" />
          }
          @default {
            <input matInput type="text" [formControl]="control" [readOnly]="saving()" />
          }
        }
      </mat-form-field>
      @if (error()) {
        <p class="cells-error" role="alert">{{ error() }}</p>
      }
      <div class="cells-editor-actions">
        <button mat-flat-button type="submit" [disabled]="saving()" disabledInteractive>
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
        <button mat-button type="button" (click)="data().close()">Cancel</button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldEditor<Row, V extends string | number>
  implements CellEditor<FieldEditorData<Row, V>>, OnInit
{
  readonly data = input.required<FieldEditorData<Row, V>>();

  protected readonly control = new FormControl<V | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    const data = this.data();
    this.control.setValidators([...(data.validators ?? [])]);
    this.control.setValue(data.value ?? null);
  }

  protected async save(): Promise<void> {
    this.control.markAsTouched();

    if (this.control.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set('');

    try {
      await this.data().submit(this.control.value);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
