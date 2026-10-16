import type { EditCommand, EditorRef, HttpQueryParams } from '@grid-cells';
interface Draft {
  name: string;
  amount: number | null;
}
interface Data {
  cell: { rowId: string; columnId: string };
  queryParams?: HttpQueryParams;
}
interface Actions {
  saveDetails(command: EditCommand<Draft>): Promise<void>;
  approveDetails(command: EditCommand<Draft>): Promise<void>;
}
// A complex editor validates its own form, then calls its feature action directly.
export async function saveComplex(
  data: Data,
  draft: Draft,
  approve: boolean,
  actions: Actions,
  ref: EditorRef,
): Promise<void> {
  const command = { cell: data.cell, data: draft, queryParams: data.queryParams };
  if (approve) await actions.approveDetails(command);
  else await actions.saveDetails(command);
  ref.close();
}
