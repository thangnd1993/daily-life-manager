import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardSummary, DashboardTrends } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  summary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('admin/dashboard/summary');
  }

  trends(): Observable<DashboardTrends> {
    return this.http.get<DashboardTrends>('admin/dashboard/trends');
  }
}
