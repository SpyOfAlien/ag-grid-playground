import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'grid-demo' },
  {
    path: 'grid-demo',
    title: 'Cell kit · Editors',
    loadComponent: () => import('./features/grid-demo/grid-demo').then((m) => m.GridDemo),
  },
  {
    path: 'column-group-demo',
    title: 'Column grouping demo',
    loadComponent: () =>
      import('./features/column-group-demo/column-group-demo').then((m) => m.ColumnGroupDemo),
  },
  {
    path: 'equipment-column-groups',
    title: 'Hospital equipment · Column groups',
    loadComponent: () =>
      import('./features/equipment-column-groups/equipment-column-groups').then(
        (m) => m.EquipmentColumnGroups,
      ),
  },
  {
    path: 'popover-demo',
    title: 'Standalone popover',
    loadComponent: () => import('./features/popover-demo/popover-demo').then((m) => m.PopoverDemo),
  },
  { path: '**', redirectTo: 'grid-demo' },
];
