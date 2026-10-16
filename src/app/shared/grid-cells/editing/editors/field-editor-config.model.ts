import type { AsyncValidatorFn, ValidatorFn } from '@angular/forms';
export interface FieldEditorConfig {
  readonly label: string;
  readonly placeholder?: string;
  readonly validators?: readonly ValidatorFn[];
  readonly asyncValidators?: readonly AsyncValidatorFn[];
}
