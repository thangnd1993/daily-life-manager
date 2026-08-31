import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AuditService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuditService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('maps bounded filters and pagination', () => {
    service.list({ page: 2, pageSize: 25, action: 'PASSWORD_CHANGED', targetType: 'USER' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === 'admin/audit-logs');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('action')).toBe('PASSWORD_CHANGED');
    expect(request.request.params.get('targetType')).toBe('USER');
    request.flush({ items: [], page: 2, pageSize: 25, totalItems: 0, totalPages: 0 });
  });
});
