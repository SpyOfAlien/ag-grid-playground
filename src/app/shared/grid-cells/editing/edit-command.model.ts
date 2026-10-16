export interface CellIdentity {
  readonly rowId: string;
  readonly columnId: string;
}

export type HttpQueryValue = string | number | boolean;
export type HttpQueryParams = Readonly<Record<string, HttpQueryValue | readonly HttpQueryValue[]>>;

/** Typed edit intent. Execution and state application belong to feature persistence. */
export interface EditCommand<T> {
  readonly cell: CellIdentity;
  readonly data: T;
  readonly queryParams?: HttpQueryParams;
}
