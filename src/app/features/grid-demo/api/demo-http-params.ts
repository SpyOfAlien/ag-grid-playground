import { HttpParams } from '@angular/common/http';
import type { HttpQueryParams } from '../../../shared/grid-cells/editing/edit-command.model';

export function demoHttpParams(query: HttpQueryParams): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query))
    for (const item of Array.isArray(value) ? value : [value])
      params = params.append(key, String(item));
  return params;
}
