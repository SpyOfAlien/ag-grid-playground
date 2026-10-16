import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { EditorSession } from './editor-session';
import { Choice } from '../presentation/display';
export type TextEditorMode = 'text' | 'multiline' | 'choice';
@Component({
  selector: 'tsys-text-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form
    [attr.aria-busy]="session().pending()"
    class="tsys-editor"
    (submit)="save($event)"
  >
    <h2>{{ title() }}</h2>
    <label [attr.for]="fieldId"
      >{{ title() }}
      @switch (mode()) {
        @case ('multiline') {
          <textarea
            [id]="fieldId"
            [formControl]="value"
            [attr.aria-describedby]="errorId"
          ></textarea>
        }
        @case ('choice') {
          <select [id]="fieldId" [formControl]="value" [attr.aria-describedby]="errorId">
            @for (choice of choices(); track choice.value) {
              <option [value]="choice.value" [disabled]="choice.disabled">
                {{ choice.label }}
              </option>
            }
          </select>
        }
        @default {
          <input [id]="fieldId" [formControl]="value" [attr.aria-describedby]="errorId" />
        }
      }
    </label>
    <p [id]="errorId" class="tsys-error" role="alert">
      {{ invalid() ? 'Enter valid text of at most 500 characters.' : session().error() }}
    </p>
    <button type="submit" [disabled]="session().pending()">Save text</button
    ><button type="button" (click)="session().close()">Cancel</button>
  </form>`,
})
export class TextEditor {
  readonly session = input.required<EditorSession<string>>();
  readonly title = input('Edit text');
  readonly required = input(false);
  readonly mode = input<TextEditorMode>('text');
  readonly choices = input<readonly Choice<string>[]>([]);
  readonly value = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(500)],
  });
  readonly invalid = signal(false);
  readonly fieldId = `tsys-text-${crypto.randomUUID()}`;
  readonly errorId = `${this.fieldId}-error`;
  ngOnInit(): void {
    if (this.required()) this.value.addValidators([Validators.required, Validators.pattern(/\S/)]);
    this.value.setValue(this.session().initial);
  }
  save(event: Event): void {
    event.preventDefault();
    this.invalid.set(
      this.value.invalid ||
        (this.mode() === 'choice' &&
          !this.choices().some((choice) => choice.value === this.value.value && !choice.disabled)),
    );
    if (this.invalid()) {
      (event.target as HTMLFormElement)
        .querySelector<HTMLElement>('input,textarea,select')
        ?.focus();
      return;
    }
    void this.session().save(this.value.value);
  }
}
