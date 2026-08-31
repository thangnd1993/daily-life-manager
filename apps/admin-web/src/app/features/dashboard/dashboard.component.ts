import { AsyncPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { DashboardSummary, DashboardTrends, TrendPoint } from './dashboard.models';
import { DashboardService } from './dashboard.service';

interface PanelState<T> {
  loading: boolean;
  data: T | null;
  error: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly summaryRetry = new BehaviorSubject(0);
  private readonly trendsRetry = new BehaviorSubject(0);

  readonly summary$: Observable<PanelState<DashboardSummary>> = this.summaryRetry.pipe(
    switchMap(() =>
      this.dashboard.summary().pipe(
        map((data) => ({ loading: false, data, error: false })),
        startWith({ loading: true, data: null, error: false }),
        catchError(() => of({ loading: false, data: null, error: true })),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly trends$: Observable<PanelState<DashboardTrends>> = this.trendsRetry.pipe(
    switchMap(() =>
      this.dashboard.trends().pipe(
        map((data) => ({ loading: false, data, error: false })),
        startWith({ loading: true, data: null, error: false }),
        catchError(() => of({ loading: false, data: null, error: true })),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor(private readonly dashboard: DashboardService) {}

  retrySummary(): void {
    this.summaryRetry.next(this.summaryRetry.value + 1);
  }

  retryTrends(): void {
    this.trendsRetry.next(this.trendsRetry.value + 1);
  }

  vnd(value: string): string {
    return `${new Intl.NumberFormat('vi-VN').format(BigInt(value))} ₫`;
  }

  barHeight(point: TrendPoint, points: TrendPoint[]): number {
    const maximum = Math.max(1, ...points.map((item) => item.count));
    return Math.max(point.count === 0 ? 4 : 12, Math.round((point.count / maximum) * 100));
  }
}
