import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { EditorSession } from './editor-session';
@Component({
  selector: 'tsys-number-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form
    [attr.aria-busy]="session().pending()"
    class="tsys-editor"
    (submit)="save($event)"
  >
    <h2>Edit amount</h2>
    <label [attr.for]="fieldId"
      >Amount in kg<input
        [id]="fieldId"
        type="number"
        step="any"
        [formControl]="amount"
        [attr.aria-invalid]="invalid()"
        [attr.aria-describedby]="errorId"
    /></label>
    <p [id]="errorId" class="tsys-error" role="alert">
      {{ invalid() ? 'Enter a finite, non-negative number or leave empty.' : session().error() }}
    </p>
    <button type="submit" [disabled]="session().pending()">Save amount</button
    ><button type="button" (click)="session().close()">Cancel</button>
  </form>`,
})
export class NumberEditor {
  readonly session = input.required<EditorSession<number | null>>();
  readonly amount = new FormControl<number | null>(null, [Validators.min(0)]);
  readonly invalid = signal(false);
  readonly fieldId = `tsys-amount-${crypto.randomUUID()}`;
  readonly errorId = `${this.fieldId}-error`;
  ngOnInit(): void {
    this.amount.setValue(this.session().initial);
  }
  save(event: Event): void {
    event.preventDefault();
    const value = this.amount.value;
    this.invalid.set(this.amount.invalid || (value !== null && !Number.isFinite(value)));
    if (this.invalid()) {
      this.amount.markAsTouched();
      (event.target as HTMLFormElement).querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    void this.session().save(value);
  }
}
