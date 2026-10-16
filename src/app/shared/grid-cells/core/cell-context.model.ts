export interface CellContext<R, V> {
  readonly rowId: string | undefined;
  readonly columnId: string;
  readonly data: Readonly<R> | undefined;
  readonly value: V | null | undefined;
}

export type CellRule<R, V, T> = T | ((cell: CellContext<R, V>) => T);

export interface CellOpenContext<R, V> extends CellContext<R, V> {
  readonly trigger: HTMLElement;
}
