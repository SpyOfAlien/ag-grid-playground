import type { NumberConfig } from './number.model';

// Bound the shared cache so dynamic column configurations cannot grow it indefinitely.
const formatters = new Map<string, Intl.NumberFormat>();
const CACHE_LIMIT = 128;
export function formatNumber(
  value: number,
  config: Pick<NumberConfig<unknown>, 'locale' | 'decimals' | 'useGrouping'> = {},
): string {
  const key = JSON.stringify([
    config.locale ?? null,
    config.decimals ?? null,
    config.useGrouping ?? true,
  ]);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(config.locale, {
      useGrouping: config.useGrouping ?? true,
      ...(config.decimals === undefined
        ? {}
        : { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }),
    });
    if (formatters.size >= CACHE_LIMIT) formatters.delete(formatters.keys().next().value!);
    formatters.set(key, formatter);
  }
  return formatter.format(value);
}
