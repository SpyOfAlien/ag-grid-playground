import { evaluate, type Cell, type CellRule } from './base';
import type { TooltipContent } from '../tooltip/tooltip';

/** Highest priority first. */
export const MARKER_KINDS = [
  'error',
  'warning',
  'userEdited',
  'systemGenerated',
  'info',
  'special',
] as const;

export type MarkerKind = (typeof MARKER_KINDS)[number];

/**
 * One reason a cell is marked: its message when it applies, otherwise nothing (`null`, `false`,
 * `undefined` or `''`). The message is the condition, so there is no separate `when` to keep in
 * step. Like every cell rule it is a function of the cell, or a fixed message for a marker that is
 * always on.
 */
export type MarkerRule<Row, V> = CellRule<Row, V, string | null | false | undefined>;

/**
 * The rules of each kind. A kind may be left out or undefined: it has no rules. Within a kind,
 * every message that applies shows in the tooltip.
 */
export type Markers<Row, V> = Partial<
  Record<MarkerKind, readonly MarkerRule<Row, V>[] | undefined>
>;

export interface ActiveMarker {
  readonly kind: MarkerKind;
  /** The kind's messages that apply, in the order of its rules. */
  readonly messages: readonly string[];
  /** One message as text; several as a list. */
  readonly tooltip: TooltipContent;
}

/** The highest-priority kind with at least one message, or null. Lower kinds are not checked. */
export function topMarker<Row, V>(
  markers: Markers<Row, V> | undefined,
  cell: Cell<Row, V>,
): ActiveMarker | null {
  for (const kind of MARKER_KINDS) {
    const messages: string[] = [];
    for (const rule of markers?.[kind] ?? []) {
      const message = evaluate(rule, cell);
      if (message) messages.push(message);
    }
    if (messages.length) return { kind, messages, tooltip: markerTooltip(messages) };
  }
  return null;
}

function markerTooltip(messages: readonly string[]): TooltipContent {
  if (messages.length === 1) return messages[0];
  return {
    html: `<ul class="cells-tooltip-list">${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`,
  };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
