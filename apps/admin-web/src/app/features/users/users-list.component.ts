import { AsyncPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { UserRole, UserStatus } from '../../core/auth/auth.models';
import { UsersPage, UsersQuery } from './users.models';
import { UsersService } from './users.service';

interface UsersViewState {
  loading: boolean;
  data: UsersPage | null;
  error: boolean;
}

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
})
export class UsersListComponent {
  readonly search = new FormControl('', { nonNullable: true });
  readonly role = new FormControl<UserRole | ''>('', { nonNullable: true });
  readonly status = new FormControl<UserStatus | ''>('', { nonNullable: true });
  private readonly queryState = new BehaviorSubject<UsersQuery>({
    page: 1,
    pageSize: 10,
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });
  private readonly retryState = new BehaviorSubject(0);

  readonly state$: Observable<UsersViewState> = combineLatest([
    this.queryState,
    this.retryState,
    this.search.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()),
    this.role.valueChanges.pipe(startWith(''), distinctUntilChanged()),
    this.status.valueChanges.pipe(startWith(''), distinctUntilChanged()),
  ]).pipe(
    map(([query, , search, role, status]) => ({
      ...query,
      search: search.trim() || undefined,
      role: role ? (role as UserRole) : undefined,
      status: status ? (status as UserStatus) : undefined,
      page: query.page,
    })),
    switchMap((query) =>
      this.users.list(query).pipe(
        map((data) => ({ loading: false, data, error: false })),
        startWith({ loading: true, data: null, error: false }),
        catchError(() => of({ loading: false, data: null, error: true })),
      ),
    ),
  );

  constructor(private readonly users: UsersService) {}

  sortBy(field: UsersQuery['sortBy']): void {
    const current = this.queryState.value;
    this.queryState.next({
      ...current,
      page: 1,
      sortBy: field,
      sortDirection: current.sortBy === field && current.sortDirection === 'asc' ? 'desc' : 'asc',
    });
  }

  page(page: number): void {
    this.queryState.next({ ...this.queryState.value, page });
  }

  resetPage(): void {
    if (this.queryState.value.page !== 1) this.page(1);
  }

  retry(): void {
    this.retryState.next(this.retryState.value + 1);
  }
}
