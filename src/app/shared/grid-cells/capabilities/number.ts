import {
  evaluateCellRule,
  toCellContext,
  type CellContext,
  type CellFacts,
  type CellRule,
} from '../core/cell-context';
import {
  computeContent,
  computeTextContent,
  type ContentPart,
  type TextContentState,
} from './content';

export interface NumberConfig<R, V = number> {
  locale?: string;
  /** Exact fraction digits, clamped to 0–100. */
  decimals?: number;
  useGrouping?: boolean;
  unit?: CellRule<R, V, string | null>;
}

export interface NumberContentState extends TextContentState {
  readonly hasValue: boolean;
  readonly unit: string | null;
}

type FormatOptions = Pick<NumberConfig<unknown>, 'locale' | 'decimals' | 'useGrouping'>;

interface CachedFormatter {
  readonly locale: string | undefined;
  readonly decimals: number | undefined;
  readonly useGrouping: boolean;
  readonly formatter: Intl.NumberFormat;
}

const NO_OPTIONS: FormatOptions = {};
// Column configs are stable objects; the shared map serves dynamic or literal configs.
const byConfig = new WeakMap<FormatOptions, CachedFormatter>();
// Bound the shared cache so dynamic column configurations cannot grow it indefinitely.
const shared = new Map<string, Intl.NumberFormat>();
const CACHE_LIMIT = 128;

function fractionDigits(decimals: number | undefined): number | undefined {
  if (decimals === undefined || !Number.isFinite(decimals)) return undefined;
  return Math.min(100, Math.max(0, Math.trunc(decimals)));
}

function createFormatter(
  locale: string | undefined,
  decimals: number | undefined,
  useGrouping: boolean,
): Intl.NumberFormat {
  const options: Intl.NumberFormatOptions = {
    useGrouping,
    ...(decimals === undefined
      ? {}
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  };
  try {
    return new Intl.NumberFormat(locale, options);
  } catch (error: unknown) {
    // An invalid locale must not break rendering; fall back to the runtime locale.
    if (error instanceof RangeError && locale !== undefined)
      return new Intl.NumberFormat(undefined, options);
    throw error;
  }
}

export function formatNumber(value: number, config: FormatOptions = NO_OPTIONS): string {
  const locale = config.locale;
  const decimals = fractionDigits(config.decimals);
  const useGrouping = config.useGrouping ?? true;
  const cached = byConfig.get(config);
  // Configs can change in place, so validate the cached options before reuse.
  if (
    cached &&
    cached.locale === locale &&
    cached.decimals === decimals &&
    cached.useGrouping === useGrouping
  )
    return cached.formatter.format(value);
  const key = `${locale ?? ''}|${decimals ?? ''}|${useGrouping}`;
  let formatter = shared.get(key);
  if (!formatter) {
    formatter = createFormatter(locale, decimals, useGrouping);
    if (shared.size >= CACHE_LIMIT) shared.delete(shared.keys().next().value!);
    shared.set(key, formatter);
  }
  byConfig.set(config, { locale, decimals, useGrouping, formatter });
  return formatter.format(value);
}

export function computeNumberContent<R, V = number>(
  params: (CellFacts<R, V> & ContentPart<R, V>) | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
): NumberContentState | null {
  const content = computeContent(params, cell);
  if (!params || !cell || !content) return null;
  const value = params.value;
  const customText = params.content?.text;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    const text = customText === undefined ? '' : evaluateCellRule(customText, cell);
    return { ...content, text, hasValue: false, unit: null };
  }
  const unit = evaluateCellRule(params.content?.number?.unit ?? null, cell) || null;
  if (customText !== undefined)
    return { ...content, text: evaluateCellRule(customText, cell), hasValue: true, unit };
  const text = formatNumber(value, params.content?.number);
  return { ...content, text: unit ? `${text} ${unit}` : text, hasValue: true, unit };
}

export function computeValueContent<R, V>(
  params: (CellFacts<R, V> & ContentPart<R, V> & { valueFormatted?: string | null }) | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
): TextContentState | null {
  return params?.content?.number !== undefined
    ? computeNumberContent(params, cell)
    : computeTextContent(params, cell);
}
