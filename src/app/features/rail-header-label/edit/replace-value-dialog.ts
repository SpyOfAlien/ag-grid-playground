import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { AutoComplete, type AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { Chip } from 'primeng/chip';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

export interface ReplaceColumnOption {
  code: string;
  name: string;
}

export interface ReplaceValueRequest {
  value: string;
  columnCodes: string[];
}

/** A value that isn't only spaces, and at least one column. */
const notBlank: ValidatorFn = (control: AbstractControl<string>) =>
  control.value.trim() ? null : { required: true };
const atLeastOne: ValidatorFn = (control: AbstractControl<string[]>) =>
  control.value.length ? null : { required: true };

/**
 * The Replace Value popup (Figma: Signal List Management, node 2319:216755): a value, and the
 * columns to put it in, starting with the column right-clicked plus the ticked ones. Columns are
 * added by searching ("Search or add a Column": pick a suggestion, or Add Column for the first
 * match) and removed from their chip. Confirm needs a value and at least one column, and emits
 * them; the page applies them as a draft.
 */
@Component({
  selector: 'app-replace-value-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AutoComplete, Button, Chip, Dialog, InputText, ReactiveFormsModule],
  template: `
    <p-dialog
      header="Replace Value"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      closeAriaLabel="Close"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      (onHide)="closed.emit()"
      [style]="{ width: '700px', maxWidth: 'calc(100vw - 32px)' }"
      [contentStyle]="{ padding: '0' }"
      styleClass="replace-value-dialog"
    >
      <form [formGroup]="form" (ngSubmit)="confirm()">
        <div class="border-t border-[#e9eaeb] px-5 py-4">
          <label for="replace-value" class="mb-2 block text-sm font-medium text-[#414651]">
            Value <span class="text-[#d92d20]" aria-hidden="true">*</span>
          </label>
          <input
            pInputText
            id="replace-value"
            class="w-full"
            formControlName="value"
            aria-required="true"
            autocomplete="off"
          />
        </div>

        <!-- No Tailwind base reset in this app: clear the browser's fieldset, legend and list
             styles by hand. -->
        <fieldset class="m-0 min-w-0 border-0 border-t border-solid border-[#e9eaeb] p-0">
          <legend class="float-left w-full p-0 px-5 pt-4">
            <span class="block text-base font-semibold text-[#181d27]">Apply multiple column</span>
            <span class="block text-sm text-[#717680]">At least 1 column must be added</span>
          </legend>

          <div
            class="clear-both flex items-center gap-3 border-y border-solid border-[#e9eaeb] bg-[#fafafa] py-1 pr-3 pl-5"
            style="margin-top: 12px"
          >
            <svg viewBox="0 0 20 20" class="size-5 shrink-0 text-[#717680]" aria-hidden="true">
              <path
                d="m17.5 17.5-3.625-3.625m1.958-4.708a6.667 6.667 0 1 1-13.333 0 6.667 6.667 0 0 1 13.333 0Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.67"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <p-autocomplete
              class="min-w-0 flex-1"
              [formControl]="search"
              [suggestions]="suggestions()"
              (completeMethod)="query.set($event.query)"
              (onSelect)="add($event)"
              optionLabel="name"
              placeholder="Search or add a Column"
              ariaLabel="Search or add a Column"
              [fluid]="true"
              appendTo="body"
            />
            <p-button
              label="Add Column"
              [text]="true"
              [disabled]="!firstMatch()"
              (onClick)="addFirstMatch()"
            >
              <ng-template #icon>
                <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true">
                  <path
                    d="M10 4.167v11.666M4.167 10h11.666"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.67"
                    stroke-linecap="round"
                  />
                </svg>
              </ng-template>
            </p-button>
          </div>

          <div class="px-5 py-3">
            <p id="replace-columns-label" class="m-0 mb-2 text-sm text-[#414651]">List Column</p>
            <ul
              class="m-0 flex list-none flex-wrap gap-2 p-0"
              aria-labelledby="replace-columns-label"
            >
              @for (column of chosen(); track column.code) {
                <li>
                  <p-chip [label]="column.name" [removable]="true" (onRemove)="remove(column.code)">
                    <!-- PrimeNG wraps it in a focusable "Remove" button. -->
                    <ng-template #removeicon>
                      <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true">
                        <path
                          d="m4 4 8 8m0-8-8 8"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                      </svg>
                    </ng-template>
                  </p-chip>
                </li>
              } @empty {
                <li class="text-sm text-[#717680]">No column yet.</li>
              }
            </ul>
          </div>
        </fieldset>
      </form>

      <ng-template #footer>
        <p-button
          label="Cancel"
          severity="secondary"
          [outlined]="true"
          (onClick)="visible.set(false)"
        />
        <p-button label="Confirm" [disabled]="form.invalid" (onClick)="confirm()" />
      </ng-template>
    </p-dialog>
  `,
  // PrimeNG renders the dialog outside this component's view, so these are scoped by its
  // styleClass instead of :host.
  styles: `
    ::ng-deep .replace-value-dialog {
      /* Chips in the Figma look: light brand teal, with its border. */
      .p-chip {
        gap: 6px;
        padding-block: 2px;
        border: 1px solid #b8e3e3;
        background: #f1fafa;
        color: #003133;
        font-size: 14px;
        font-weight: 500;
      }

      /* The search sits on the grey row, with the icon before it and no box of its own. */
      .p-autocomplete-input {
        border-color: transparent;
        background: transparent;
        box-shadow: none;
      }

      .p-dialog-footer {
        padding-top: 16px;
        border-top: 1px solid #e9eaeb;
      }
    }
  `,
})
export class ReplaceValueDialog {
  /** Every data column that can be replaced, in table order. */
  readonly columns = input.required<readonly ReplaceColumnOption[]>();
  readonly replace = output<ReplaceValueRequest>();
  /** After it closes, by Confirm, Cancel, Escape or the close button. */
  readonly closed = output<void>();

  protected readonly form = new FormGroup({
    value: new FormControl('', { nonNullable: true, validators: [Validators.required, notBlank] }),
    columnCodes: new FormControl<string[]>([], { nonNullable: true, validators: [atLeastOne] }),
  });
  protected readonly search = new FormControl<ReplaceColumnOption | string | null>(null);

  protected readonly visible = signal(false);
  protected readonly query = signal('');
  private readonly codes = toSignal(this.form.controls.columnCodes.valueChanges, {
    initialValue: [] as string[],
  });

  protected readonly chosen = computed(() => {
    const codes = new Set(this.codes());
    return this.columns().filter(({ code }) => codes.has(code));
  });
  /** Columns not chosen yet whose name contains the search text. */
  protected readonly suggestions = computed(() => {
    const codes = new Set(this.codes());
    const text = this.query().trim().toLowerCase();
    return this.columns().filter(
      ({ code, name }) => !codes.has(code) && name.toLowerCase().includes(text),
    );
  });
  protected readonly firstMatch = computed(() =>
    this.query().trim() ? this.suggestions()[0] : undefined,
  );

  /** Opens the popup with these columns already in the list, and no value. */
  open(columnCodes: readonly string[]): void {
    this.form.reset({ value: '', columnCodes: [...columnCodes] });
    this.search.setValue(null);
    this.query.set('');
    this.visible.set(true);
  }

  protected add(event: AutoCompleteSelectEvent): void {
    this.addColumn((event.value as ReplaceColumnOption).code);
  }

  protected addFirstMatch(): void {
    const match = this.firstMatch();
    if (match) this.addColumn(match.code);
  }

  protected remove(code: string): void {
    const codes = this.form.controls.columnCodes;
    codes.setValue(codes.value.filter((existing) => existing !== code));
  }

  protected confirm(): void {
    if (this.form.invalid) return;
    const { value, columnCodes } = this.form.getRawValue();
    this.replace.emit({ value: value.trim(), columnCodes });
    this.visible.set(false);
  }

  private addColumn(code: string): void {
    const codes = this.form.controls.columnCodes;
    if (!codes.value.includes(code)) codes.setValue([...codes.value, code]);
    this.search.setValue(null);
    this.query.set('');
  }
}
