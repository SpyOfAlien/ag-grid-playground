import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EditorSession } from '../../../shared/table-system/editors/editor-session';
import { DetailsDraft } from '../domain/details-command';
@Component({
  selector: 'tsys-details-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form
    [attr.aria-busy]="session().pending()"
    class="tsys-editor"
    [formGroup]="form"
    (submit)="submit($event, 'save')"
  >
    <h2>Edit item details</h2>
    <label [attr.for]="idPrefix + '-name'"
      >Name<input
        [id]="idPrefix + '-name'"
        formControlName="name"
        [attr.aria-invalid]="invalid() && form.controls.name.invalid"
        [attr.aria-describedby]="errorId"
    /></label>
    <label [attr.for]="idPrefix + '-amount'"
      >Amount in kg<input
        [id]="idPrefix + '-amount'"
        type="number"
        step="any"
        formControlName="amount"
        [attr.aria-invalid]="invalid() && form.controls.amount.invalid"
        [attr.aria-describedby]="errorId"
    /></label>
    <label [attr.for]="idPrefix + '-note'"
      >Notes<textarea
        [id]="idPrefix + '-note'"
        formControlName="note"
        [attr.aria-invalid]="invalid() && form.controls.note.invalid"
        [attr.aria-describedby]="errorId"
      ></textarea>
    </label>
    <p [id]="errorId" class="tsys-error" role="alert">
      {{
        invalid()
          ? 'Name is required. Amount must be non-negative. Notes must be at most 500 characters.'
          : session().error()
      }}
    </p>
    <button type="submit" [disabled]="session().pending()">Save details</button
    ><button
      type="button"
      [disabled]="session().pending() || !mayApprove()()"
      (click)="submit($event, 'approve')"
    >
      Save and approve</button
    ><button type="button" (click)="session().close()">Cancel</button>
  </form>`,
})
export class DetailsEditor {
  readonly session = input.required<EditorSession<DetailsDraft>>();
  readonly mayApprove = input.required<() => boolean>();
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    amount: new FormControl<number | null>(null, Validators.min(0)),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });
  readonly invalid = signal(false);
  readonly idPrefix = `tsys-details-${crypto.randomUUID()}`;
  readonly errorId = `${this.idPrefix}-error`;
  ngOnInit(): void {
    this.form.setValue(this.session().initial);
  }
  submit(event: Event, action: 'save' | 'approve'): void {
    event.preventDefault();
    const draft = this.form.getRawValue();
    this.invalid.set(
      this.form.invalid ||
        !draft.name.trim() ||
        (draft.amount !== null && !Number.isFinite(draft.amount)),
    );
    if (this.invalid()) {
      this.form.markAllAsTouched();
      const element = event.target as HTMLElement;
      const field = this.form.controls.name.invalid
        ? 'name'
        : this.form.controls.amount.invalid
          ? 'amount'
          : 'note';
      element.closest('form')?.querySelector<HTMLElement>(`[formControlName="${field}"]`)?.focus();
      return;
    }
    void this.session().save(draft, action);
  }
}
