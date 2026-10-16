import { computed, Directive, inject, input, type OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, type AsyncValidatorFn, type ValidatorFn } from '@angular/forms';
import { GRID_CELL_LABELS } from '../../core/labels';
import { trackSave } from '../../capabilities/save';
import type { ValueEditorData } from '../cell-editor';
import { EditorRef } from '../editor-host/editor-ref';

export interface FieldEditorConfig {
  readonly label: string;
  readonly placeholder?: string;
  readonly validators?: readonly ValidatorFn[];
  readonly asyncValidators?: readonly AsyncValidatorFn[];
}

/** Shared form, validation and submission behavior for single-field hosted editors. */
@Directive()
export abstract class FieldEditor<V, C extends FieldEditorConfig> implements OnInit {
  private readonly editorRef = inject(EditorRef);
  protected readonly labels = inject(GRID_CELL_LABELS);

  readonly data = input.required<ValueEditorData<V, C>>();

  readonly control = this.createControl();
  readonly form = new FormGroup({ value: this.control });

  private readonly events = toSignal(this.control.events, { initialValue: null });
  private readonly submission = trackSave();

  readonly saving = computed(() => this.submission.state().pending);
  readonly error = computed(() => this.submission.state().error);
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
    this.control.setValidators([
      ...(data.config.validators ?? []),
      ...this.validators(data.config),
    ]);
    this.control.setAsyncValidators([...(data.config.asyncValidators ?? [])]);
    this.control.setValue(data.initialValue);
  }

  close(): void {
    this.editorRef.close();
  }

  async save(): Promise<void> {
    this.control.markAsTouched();
    if (!this.canSave()) return;
    const data = this.data();
    if ((await this.submission.run(() => data.save(this.control.value))) === 'saved')
      this.editorRef.close();
  }

  /** Called while fields initialize, before subclass fields exist. */
  protected abstract createControl(): FormControl<V>;

  /** Validators implied by the editor's own configuration. */
  protected validators(_config: C): ValidatorFn[] {
    return [];
  }
}
