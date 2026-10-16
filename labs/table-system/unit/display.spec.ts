import { it, expect } from 'vitest';
import {
  computeChoice,
  computeDescription,
  computeMarker,
  computeNumber,
  computeText,
} from '../../../src/app/shared/table-system/presentation/display';
it('defines null, empty, zero, finite and units explicitly', () => {
  expect(computeText('')).toBe('(empty)');
  expect(computeText(null)).toBe('—');
  expect(computeNumber(0, { decimals: 2, unit: 'kg' })).toBe('0.00 kg');
  expect(computeNumber(NaN, { decimals: 2 })).toBe('Invalid number');
  expect(computeNumber(null, { decimals: 2 })).toBe('—');
});
it('retains all essential descriptions but prioritizes error marker', () => {
  const annotations = [
    { kind: 'info' as const, text: 'i' },
    { kind: 'error' as const, text: 'e' },
    { kind: 'warning' as const, text: 'w' },
  ];
  expect(computeMarker(annotations)?.kind).toBe('error');
  expect(computeDescription(annotations)).toContain('warning: w');
});
it('supports explicit choice equality, disabled choices and unmatched values', () => {
  const choices = [{ value: { id: 1 }, label: 'One', disabled: true }];
  expect(computeChoice({ id: 1 }, choices, (a, b) => a.id === b.id)?.disabled).toBe(true);
  expect(computeChoice({ id: 2 }, choices, (a, b) => a.id === b.id)).toBeUndefined();
});
