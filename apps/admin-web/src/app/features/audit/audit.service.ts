import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogPage, AuditLogQuery } from './audit.models';

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private readonly http: HttpClient) {}

  list(query: AuditLogQuery): Observable<AuditLogPage> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.action) params = params.set('action', query.action);
    if (query.targetType) params = params.set('targetType', query.targetType);
    return this.http.get<AuditLogPage>('admin/audit-logs', { params });
  }
}
