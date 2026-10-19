import { evaluate, type Cell, type CellRule } from './base';

export interface NumberFormat<Row> {
  locale?: string;
  /** Exact fraction digits, 0–20. */
  decimals?: number;
  /** Thousands separators; defaults to true. */
  grouping?: boolean;
  unit?: CellRule<Row, number, string | null>;
}

// Creating Intl.NumberFormat is slow; a grid formats thousands of cells with a few settings.
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string | undefined, decimals: number | undefined, grouping: boolean) {
  const key = `${locale}|${decimals}|${grouping}`;
  let cached = formatters.get(key);

  if (!cached) {
    const digits =
      decimals === undefined
        ? {}
        : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    cached = new Intl.NumberFormat(locale, { useGrouping: grouping, ...digits });
    formatters.set(key, cached);
  }

  return cached;
}

/** Empty for a missing value; otherwise the formatted number and its unit. */
export function formatNumber<Row>(
  config: NumberFormat<Row> | undefined,
  cell: Cell<Row, number>,
): string {
  if (cell.value == null) return '';

  const decimals =
    config?.decimals === undefined
      ? undefined
      : Math.min(20, Math.max(0, Math.trunc(config.decimals)));
  const text = formatter(config?.locale, decimals, config?.grouping ?? true).format(cell.value);
  const unit = evaluate(config?.unit ?? null, cell);

  return unit ? `${text} ${unit}` : text;
}
