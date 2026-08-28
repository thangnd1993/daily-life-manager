import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((component) => component.DashboardComponent),
    title: 'Dashboard · Daily Life Manager',
  },
  { path: '**', redirectTo: '' },
];
