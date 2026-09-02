import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UserStatus } from '../../core/auth/auth.models';
import { AdminUserDetail, AttendancePage, FinanceInsights, FinancePage, UsersPage, UsersQuery } from './users.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  list(query: UsersQuery): Observable<UsersPage> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);
    if (query.search) params = params.set('search', query.search);
    if (query.role) params = params.set('role', query.role);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<UsersPage>('admin/users', { params });
  }

  detail(id: string): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`admin/users/${id}`);
  }

  updateStatus(id: string, status: UserStatus): Observable<AdminUserDetail> {
    return this.http.patch<AdminUserDetail>(`admin/users/${id}/status`, { status });
  }

  updateAttendanceEnabled(id: string, enabled: boolean): Observable<AdminUserDetail> {
    return this.http.patch<AdminUserDetail>(`admin/users/${id}/attendance`, { enabled });
  }

  attendance(id: string, year: number, month: number): Observable<AttendancePage> {
    const params = new HttpParams().set('year', year).set('month', month).set('pageSize', 31);
    return this.http.get<AttendancePage>(`admin/users/${id}/attendance`, { params });
  }

  finance(id: string, year: number, month: number, page: number): Observable<FinancePage> {
    const params = new HttpParams().set('year', year).set('month', month).set('page', page).set('pageSize', 10);
    return this.http.get<FinancePage>(`admin/users/${id}/transactions`, { params });
  }

  financeInsights(id: string, year: number, month: number): Observable<FinanceInsights> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<FinanceInsights>(`admin/users/${id}/finance-insights`, { params });
  }
}
