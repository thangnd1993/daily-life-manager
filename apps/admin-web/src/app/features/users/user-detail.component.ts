import { AsyncPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { UserStatus } from '../../core/auth/auth.models';
import { AdminUserDetail } from './users.models';
import { UsersService } from './users.service';

interface DetailState {
  loading: boolean;
  user: AdminUserDetail | null;
  error: boolean;
}

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss',
})
export class UserDetailComponent {
  private readonly reloadState = new BehaviorSubject(0);
  readonly state$: Observable<DetailState> = this.reloadState.pipe(
    switchMap(() =>
      this.users.detail(this.route.snapshot.paramMap.get('id') ?? '').pipe(
        map((user) => ({ loading: false, user, error: false })),
        startWith({ loading: true, user: null, error: false }),
        catchError(() => of({ loading: false, user: null, error: true })),
      ),
    ),
  );
  pendingStatus: UserStatus | null = null;
  saving = false;
  feedback = '';
  readonly attendanceMonth = new BehaviorSubject({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  readonly attendance$ = this.attendanceMonth.pipe(
    switchMap(({ year, month }) =>
      this.users.attendance(this.route.snapshot.paramMap.get('id') ?? '', year, month).pipe(
        map((data) => ({ loading: false, data, error: false })),
        startWith({ loading: true, data: null, error: false }),
        catchError(() => of({ loading: false, data: null, error: true })),
      ),
    ),
  );
  readonly financeQuery = new BehaviorSubject({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    page: 1,
  });
  readonly finance$ = this.financeQuery.pipe(
    switchMap(({ year, month, page }) =>
      this.users.finance(this.route.snapshot.paramMap.get('id') ?? '', year, month, page).pipe(
        map((data) => ({ loading: false, data, error: false })),
        startWith({ loading: true, data: null, error: false }),
        catchError(() => of({ loading: false, data: null, error: true })),
      ),
    ),
  );
  readonly financeInsights$ = this.financeQuery.pipe(
    switchMap(({ year, month }) =>
      this.users.financeInsights(this.route.snapshot.paramMap.get('id') ?? '', year, month).pipe(
        map((data) => ({ loading: false, data, error: false })),
        startWith({ loading: true, data: null, error: false }),
        catchError(() => of({ loading: false, data: null, error: true })),
      ),
    ),
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly users: UsersService,
  ) {}

  requestStatus(status: UserStatus): void {
    this.pendingStatus = status;
    this.feedback = '';
  }

  cancelStatus(): void {
    this.pendingStatus = null;
  }

  confirmStatus(user: AdminUserDetail): void {
    if (!this.pendingStatus) return;
    this.saving = true;
    this.users.updateStatus(user.id, this.pendingStatus).subscribe({
      next: () => {
        this.saving = false;
        this.pendingStatus = null;
        this.feedback = 'Account status updated.';
        this.reloadState.next(this.reloadState.value + 1);
      },
      error: () => {
        this.saving = false;
        this.feedback = 'The status could not be updated.';
      },
    });
  }

  toggleAttendance(user: AdminUserDetail): void {
    this.saving = true;
    this.users.updateAttendanceEnabled(user.id, !user.attendanceEnabled).subscribe({
      next: () => {
        this.saving = false;
        this.feedback = `Attendance ${user.attendanceEnabled ? 'disabled' : 'enabled'}.`;
        this.reloadState.next(this.reloadState.value + 1);
      },
      error: () => {
        this.saving = false;
        this.feedback = 'Attendance configuration could not be updated.';
      },
    });
  }

  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
  }

  retry(): void {
    this.reloadState.next(this.reloadState.value + 1);
  }

  changeAttendanceMonth(offset: number): void {
    const current = this.attendanceMonth.value;
    const date = new Date(current.year, current.month - 1 + offset, 1);
    this.attendanceMonth.next({ year: date.getFullYear(), month: date.getMonth() + 1 });
  }

  changeFinanceMonth(offset: number): void {
    const current = this.financeQuery.value;
    const date = new Date(current.year, current.month - 1 + offset, 1);
    this.financeQuery.next({ year: date.getFullYear(), month: date.getMonth() + 1, page: 1 });
  }

  changeFinancePage(page: number): void {
    this.financeQuery.next({ ...this.financeQuery.value, page });
  }

  formatVnd(value: string): string {
    return `${new Intl.NumberFormat('vi-VN').format(BigInt(value))} ₫`;
  }
}
