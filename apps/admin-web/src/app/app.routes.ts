import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    redirectTo: 'users',
    pathMatch: 'full',
  },
  {
    path: 'users',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/users/users-list.component').then((component) => component.UsersListComponent),
    title: 'Users · Daily Life Manager',
  },
  {
    path: 'users/:id',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/users/user-detail.component').then((component) => component.UserDetailComponent),
    title: 'User detail · Daily Life Manager',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((component) => component.LoginComponent),
    title: 'Sign in · Daily Life Manager',
  },
  { path: '**', redirectTo: 'users' },
];
