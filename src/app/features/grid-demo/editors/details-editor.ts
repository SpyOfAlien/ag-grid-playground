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
import {
  EditorRef,
  type HostedEditor,
} from '../../../shared/grid-cells/editing/editor-host/public-api';
import type { DetailsEditorData } from './details-editor-data.model';
import { DEMO_TABLE_PERSISTENCE } from '../demo-persistence.model';
import { DemoServerPersistence } from '../demo-server-persistence';
import { DemoTableState } from '../demo-table-state';
@Component({
  selector: 'app-details-editor',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit(false)">
      <mat-form-field appearance="outline"
        ><mat-label>Name</mat-label>
        <input
          matInput
          type="text"
          formControlName="name"
          aria-label="Details name"
          [readOnly]="saving()"
        /><mat-error>Enter a name of up to 60 characters.</mat-error></mat-form-field
      >
      <mat-form-field appearance="outline"
        ><mat-label>Amount</mat-label>
        <input
          matInput
          type="number"
          formControlName="amount"
          aria-label="Details amount"
          [readOnly]="saving()"
        /><mat-error>Enter a finite, non-negative amount.</mat-error></mat-form-field
      >
      <mat-form-field appearance="outline"
        ><mat-label>Notes</mat-label>
        <textarea
          matInput
          formControlName="notes"
          aria-label="Details notes"
          [readOnly]="saving()"
          rows="4"
        ></textarea>
        <mat-error>Notes can have up to 2,000 characters.</mat-error></mat-form-field
      >
      <p role="alert">{{ error() }}</p>
      <div class="actions">
        <button mat-flat-button type="submit" [disabled]="!valid() || saving()">
          Save details
        </button>
        <button
          mat-stroked-button
          type="button"
          (click)="submit(true)"
          [disabled]="!valid() || saving()"
        >
          Save and approve
        </button>
        <button mat-button type="button" (click)="close()">Cancel</button>
      </div>
    </form>
  `,
  styleUrl: './details-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsEditor implements HostedEditor<DetailsEditorData>, OnInit {
  private readonly editorRef = inject(EditorRef);
  private readonly persistence = inject(DEMO_TABLE_PERSISTENCE);
  private readonly server = inject(DemoServerPersistence, { optional: true });
  private readonly table = inject(DemoTableState);

  readonly data = input.required<DetailsEditorData>();

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(60)],
    }),
    amount: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(0),
        (control) =>
          typeof control.value === 'number' && Number.isFinite(control.value)
            ? null
            : { finite: true },
      ],
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  private readonly events = toSignal(this.form.events, { initialValue: null });
  readonly saving = signal(false);
  readonly error = signal('');

  readonly valid = computed(() => {
    this.events();
    return this.form.valid;
  });
  readonly dirty = computed(() => {
    this.events();
    const value = this.form.getRawValue();
    const initial = this.data().initialValue;
    return (
      value.name !== initial.name ||
      value.amount !== initial.amount ||
      value.notes !== initial.notes
    );
  });

  ngOnInit(): void {
    const initial = this.data().initialValue;
    this.form.setValue({
      name: initial.name,
      amount: initial.amount ?? null,
      notes: initial.notes,
    });
  }

  close(): void {
    this.editorRef.close();
  }

  async submit(approve: boolean): Promise<void> {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const data = this.data();
    const value = this.form.getRawValue();
    try {
      const persistence =
        this.table.mode() === 'server' ? (this.server ?? this.persistence) : this.persistence;
      const command = {
        cell: data.cell,
        data: { ...value, revision: data.initialValue.revision },
        queryParams: data.queryParams,
      };
      if (approve) await persistence.approveDetails(command);
      else await persistence.saveDetails(command);
      this.editorRef.close();
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
