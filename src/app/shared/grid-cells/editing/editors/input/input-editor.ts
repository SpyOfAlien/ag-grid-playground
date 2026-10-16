import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { EditorRef, type HostedEditor } from '../../editor-host/public-api';
import type { InputEditorData } from './input-editor-config.model';

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
        <mat-error>Enter a valid value.</mat-error>
      </mat-form-field>
      <p role="alert">{{ error() }}</p>
      <div class="actions">
        <button mat-flat-button type="submit" [disabled]="!canSave()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
        <button mat-button type="button" (click)="close()">Cancel</button>
      </div>
    </form>
  `,
  styleUrl: './input-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputEditor<V extends string | number = string>
  implements HostedEditor<InputEditorData<V>>, OnInit
{
  private readonly editorRef = inject(EditorRef);
  readonly data = input.required<InputEditorData<V>>();

  readonly control = new FormControl<V | null>(null);
  readonly form = new FormGroup({ value: this.control });

  private readonly events = toSignal(this.control.events, { initialValue: null });
  readonly saving = signal(false);
  readonly error = signal('');

  readonly dirty = computed(() => {
    this.events();
    return this.control.value !== (this.data().initialValue ?? null);
  });
  readonly invalid = computed(() => {
    this.events();
    return this.control.invalid;
  });
  readonly canSave = computed(() => {
    this.events();
    return this.control.valid && !this.control.pending && !this.saving();
  });

  ngOnInit(): void {
    const data = this.data();
    const validators = [...(data.config.validators ?? [])];
    if (data.config.mode === 'number')
      validators.push((control) =>
        control.value == null ||
        (typeof control.value === 'number' && Number.isFinite(control.value))
          ? null
          : { finiteNumber: true },
      );
    this.control.setValidators(validators);
    this.control.setAsyncValidators([...(data.config.asyncValidators ?? [])]);
    this.control.setValue(data.initialValue ?? null);
  }

  close(): void {
    this.editorRef.close();
  }

  async save(): Promise<void> {
    this.control.markAsTouched();
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set('');
    const data = this.data();
    try {
      await data.save(this.control.value);
      this.editorRef.close();
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
