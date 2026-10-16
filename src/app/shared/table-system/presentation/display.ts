export interface NumberDisplay {
  readonly decimals: number;
  readonly unit?: string;
}
export interface Annotation {
  readonly kind: 'error' | 'warning' | 'info';
  readonly text: string;
}
export function computeNumber(value: number | null | undefined, display: NumberDisplay): string {
  if (value === null || value === undefined) return '—';
  if (!Number.isFinite(value)) return 'Invalid number';
  return value.toFixed(display.decimals) + (display.unit ? ` ${display.unit}` : '');
}
export function computeText(value: string | null | undefined): string {
  return value == null ? '—' : value === '' ? '(empty)' : value;
}
export function computeMarker(annotations: readonly Annotation[]): Annotation | undefined {
  const rank = { error: 0, warning: 1, info: 2 };
  return [...annotations].sort((a, b) => rank[a.kind] - rank[b.kind])[0];
}
export function computeDescription(annotations: readonly Annotation[]): string {
  return annotations.map((a) => `${a.kind}: ${a.text}`).join('. ');
}

export interface Choice<V> {
  readonly value: V;
  readonly label: string;
  readonly disabled?: boolean;
}
export function computeChoice<V>(
  value: V,
  choices: readonly Choice<V>[],
  equals: (a: V, b: V) => boolean = Object.is,
): Choice<V> | undefined {
  return choices.find((choice) => equals(value, choice.value));
}

export function computeChoiceIndex<V>(
  value: V,
  choices: readonly Choice<V>[],
  equals: (a: V, b: V) => boolean = Object.is,
): number {
  return choices.findIndex((choice) => equals(value, choice.value));
}
