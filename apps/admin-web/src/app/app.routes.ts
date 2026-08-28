import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((component) => component.DashboardComponent),
    title: 'Dashboard · Daily Life Manager',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((component) => component.LoginComponent),
    title: 'Sign in · Daily Life Manager',
  },
  { path: '**', redirectTo: '' },
];
