import { ChangeDetectionStrategy, Component, input, signal, type OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { CellEditor, EditorData } from '@cells';
import type { ApprovePayload } from './inventory-persistence';
import type { Item } from './inventory.model';

export interface ItemDraft {
  readonly name: string;
  readonly qty: number | null;
  readonly notes: string;
}

export type ItemDetailsData = EditorData<Item, null, ItemDraft>;

/** Edits several fields in one payload, or approves the item through another method. */
@Component({
  selector: 'app-item-details-editor',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form class="cells-field-editor" [formGroup]="form" (ngSubmit)="save()">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput formControlName="name" [readOnly]="busy()" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Quantity</mat-label>
        <input matInput type="number" formControlName="qty" [readOnly]="busy()" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Notes</mat-label>
        <textarea matInput rows="3" formControlName="notes" [readOnly]="busy()"></textarea>
      </mat-form-field>
      @if (error()) {
        <p class="cells-error" role="alert">{{ error() }}</p>
      }
      <div class="cells-editor-actions">
        <button
          mat-button
          type="button"
          [disabled]="busy() || data().row.approved"
          (click)="approve()"
        >
          Approve
        </button>
        <button mat-flat-button type="submit" [disabled]="busy()">Save</button>
        <button mat-button type="button" (click)="data().close()">Cancel</button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailsEditor implements CellEditor<ItemDetailsData>, OnInit {
  readonly data = input.required<ItemDetailsData>();

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    qty: new FormControl<number | null>(null, Validators.min(0)),
    notes: new FormControl('', { nonNullable: true }),
  });
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    const { name, qty, notes } = this.data().row;
    this.form.setValue({ name, qty, notes });
  }

  protected save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return Promise.resolve();
    return this.attempt(() => this.data().submit(this.form.getRawValue()));
  }

  protected approve(): Promise<void> {
    const data = this.data();
    const payload: ApprovePayload = { skus: [data.row.sku] };
    return this.attempt(async () => {
      await data.session.run({ method: 'approve', payload });
      data.close();
    });
  }

  private async attempt(task: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await task();
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }
}
