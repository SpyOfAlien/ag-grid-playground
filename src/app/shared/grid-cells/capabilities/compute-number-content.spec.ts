import { computeNumberContent } from './number';
import { formatNumber } from './number';
import type { CellFacts } from '../core/cell-context';
import type { ContentPart } from './content';
const base: CellFacts<{ unit: string }, number> & ContentPart<{ unit: string }, number> = {
  data: { unit: 'kg' },
  node: { id: 'r1' },
  value: 1250.123,
  content: {
    number: { locale: 'en-US', decimals: 2, unit: 'kg' },
  },
};
describe('Number computation', () => {
  it('returns null before initialization', () => expect(computeNumberContent(null)).toBeNull());
  it('formats grouped decimals and a unit without changing the raw value', () => {
    expect(computeNumberContent(base)).toMatchObject({
      text: '1,250.12 kg',
      hasValue: true,
      unit: 'kg',
    });
    expect(base.value).toBe(1250.123);
  });
  it('applies custom text to every value, like text cells, without a unit for missing values', () => {
    const text = vi.fn(({ value }: { value: number | null | undefined }) =>
      value == null ? 'Not measured' : 'Custom amount',
    );
    const params = { ...base, content: { text } };
    expect(computeNumberContent(params)?.text).toBe('Custom amount');
    expect(computeNumberContent({ ...params, value: null })).toMatchObject({
      text: 'Not measured',
      hasValue: false,
      unit: null,
    });
  });
  it('skips numeric formatting when custom text supplies the display', () => {
    const OriginalNumberFormat = Intl.NumberFormat;
    const format = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (locales, options) {
      return new OriginalNumberFormat(locales, options);
    });
    const params = {
      ...base,
      content: { number: { locale: 'it-CH', decimals: 9, unit: 'kg' } },
    };
    try {
      expect(
        computeNumberContent({ ...params, content: { ...params.content, text: 'Custom' } }),
      ).toMatchObject({ text: 'Custom', unit: 'kg', hasValue: true });
      expect(format).not.toHaveBeenCalled();
      computeNumberContent(params);
      expect(format).toHaveBeenCalledOnce();
    } finally {
      format.mockRestore();
    }
  });
  it('keeps zero and its unit', () =>
    expect(computeNumberContent({ ...base, value: 0 })).toMatchObject({
      text: '0.00 kg',
      hasValue: true,
      unit: 'kg',
    }));
  it.each([null, undefined, NaN, Infinity, -Infinity])(
    'omits invalid/missing value %s and never evaluates its unit',
    (value) => {
      const unit = vi.fn(() => 'kg');
      expect(
        computeNumberContent({
          ...base,
          value,
          content: {
            number: { unit },
          },
        }),
      ).toMatchObject({
        text: '',
        unit: null,
        hasValue: false,
      });
      expect(unit).not.toHaveBeenCalled();
    },
  );
  it.each([null, ''])('omits empty unit %s', (unit) =>
    expect(
      computeNumberContent({
        ...base,
        content: {
          number: { ...base.content?.number, unit },
        },
      })?.text,
    ).toBe('1,250.12'),
  );
  it('resolves units again when row metadata changes', () => {
    const params: typeof base = {
      ...base,
      content: {
        number: { ...base.content?.number, unit: ({ data }) => data?.unit ?? null },
      },
    };
    expect(computeNumberContent(params)?.text).toBe('1,250.12 kg');
    params.data!.unit = 'lb';
    expect(computeNumberContent(params)?.text).toBe('1,250.12 lb');
  });
  it('supports locale, grouping, and exact fractional digit configuration', () => {
    expect(formatNumber(1250.5, { locale: 'de-DE', decimals: 2 })).toBe('1.250,50');
    expect(formatNumber(1250.5, { locale: 'en-US', decimals: 0, useGrouping: false })).toBe('1251');
  });
  it('reuses a formatter for identical options', () => {
    const OriginalNumberFormat = Intl.NumberFormat;
    const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (locales, options) {
      return new OriginalNumberFormat(locales, options);
    });
    try {
      formatNumber(1, { locale: 'fr-CA', decimals: 7, useGrouping: false });
      formatNumber(2, { locale: 'fr-CA', decimals: 7, useGrouping: false });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('clamps fraction digits and falls back for an invalid locale instead of throwing', () => {
    expect(formatNumber(1.5, { locale: 'en-US', decimals: -2 })).toBe('2');
    expect(formatNumber(1.5, { locale: 'en-US', decimals: 2.9 })).toBe('1.50');
    expect(() => formatNumber(1, { decimals: 500 })).not.toThrow();
    expect(() => formatNumber(1, { locale: 'not a locale!' })).not.toThrow();
  });
  it('rechecks a cached config after it changes in place', () => {
    const config = { locale: 'en-US', decimals: 1 };
    expect(formatNumber(2, config)).toBe('2.0');
    config.decimals = 3;
    expect(formatNumber(2, config)).toBe('2.000');
  });
});
