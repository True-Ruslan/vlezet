const NBSP = "\u00a0";

export type FormatNumberRuOptions = Readonly<Intl.NumberFormatOptions>;

export function formatNumberRu(value: number, options: FormatNumberRuOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", options).format(value);
}

export function formatMillimeters(value: number, options: FormatNumberRuOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  const formatted = formatNumberRu(value, {
    useGrouping: false,
    maximumFractionDigits: 0,
    ...options,
  });
  return `${formatted}${NBSP}мм`;
}

export function formatSquareMeters(value: number, options: FormatNumberRuOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  const formatted = formatNumberRu(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
  return `${formatted}${NBSP}м²`;
}

export function formatDegrees(value: number, options: FormatNumberRuOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  return `${formatNumberRu(value, { useGrouping: false, maximumFractionDigits: 2, ...options })}°`;
}
