import { AsyncPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { AuditLogItem, AuditLogPage, AuditLogQuery } from './audit.models';
import { AuditService } from './audit.service';

interface AuditState {
  loading: boolean;
  data: AuditLogPage | null;
  error: boolean;
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss',
})
export class AuditComponent {
  readonly action = new FormControl('', { nonNullable: true });
  readonly targetType = new FormControl('', { nonNullable: true });
  private readonly query = new BehaviorSubject<AuditLogQuery>({ page: 1, pageSize: 25 });
  private readonly retryState = new BehaviorSubject(0);

  readonly state$: Observable<AuditState> = combineLatest([
    this.query,
    this.retryState,
    this.action.valueChanges.pipe(startWith('')),
    this.targetType.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([query, , action, targetType]) => ({
      ...query,
      action: action || undefined,
      targetType: targetType || undefined,
    })),
    switchMap((query) =>
      this.audit.list(query).pipe(
        map((data) => ({ loading: false, data, error: false })),
        startWith({ loading: true, data: null, error: false }),
        catchError(() => of({ loading: false, data: null, error: true })),
      ),
    ),
  );

  constructor(private readonly audit: AuditService) {}

  page(page: number): void {
    this.query.next({ ...this.query.value, page });
  }

  resetPage(): void {
    if (this.query.value.page !== 1) this.page(1);
  }

  retry(): void {
    this.retryState.next(this.retryState.value + 1);
  }

  metadata(item: AuditLogItem): string {
    if (!item.metadata || Object.keys(item.metadata).length === 0) return '—';
    return Object.entries(item.metadata)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }
}
