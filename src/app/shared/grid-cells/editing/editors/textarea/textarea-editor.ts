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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { EditorRef, type HostedEditor } from '../../editor-host/public-api';
import type { TextareaEditorData } from './textarea-editor-config.model';

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
  styleUrl: './textarea-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextareaEditor implements HostedEditor<TextareaEditorData>, OnInit {
  private readonly editorRef = inject(EditorRef);
  readonly data = input.required<TextareaEditorData>();

  readonly control = new FormControl('', { nonNullable: true });
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

    if (data.config.maxLength !== undefined)
      validators.push(Validators.maxLength(data.config.maxLength));
    this.control.setValidators(validators);
    this.control.setAsyncValidators([...(data.config.asyncValidators ?? [])]);
    this.control.setValue(data.initialValue);
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
