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

  retry(): void {
    this.reloadState.next(this.reloadState.value + 1);
  }
}
