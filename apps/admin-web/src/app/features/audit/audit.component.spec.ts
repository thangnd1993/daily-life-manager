import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuditLogPage } from './audit.models';
import { AuditComponent } from './audit.component';
import { AuditService } from './audit.service';

const page: AuditLogPage = {
  items: [
    {
      id: 'audit-1',
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
      action: 'ADMIN_USER_STATUS_CHANGED',
      targetType: 'USER',
      targetId: 'user-1',
      outcome: 'SUCCESS',
      metadata: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' },
      ipAddress: '127.0.0.1',
      userAgent: null,
      createdAt: '2026-08-31T10:00:00Z',
      actor: { displayName: 'Admin', email: 'admin@example.com' },
    },
  ],
  page: 1,
  pageSize: 25,
  totalItems: 1,
  totalPages: 1,
};

describe('AuditComponent', () => {
  const audit = { list: jest.fn() };
  beforeEach(async () => {
    audit.list.mockReset().mockReturnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [AuditComponent],
      providers: [{ provide: AuditService, useValue: audit }],
    }).compileComponents();
  });

  it('renders safe audit details and filters', () => {
    const fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('ADMIN_USER_STATUS_CHANGED');
    expect(text).toContain('previousStatus: ACTIVE');
    fixture.componentInstance.action.setValue('PASSWORD_CHANGED');
    expect(audit.list).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'PASSWORD_CHANGED' }));
  });

  it('shows loading, empty, and error states with retry', () => {
    audit.list.mockReturnValue(new Subject<AuditLogPage>());
    let fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading audit records');

    audit.list.mockReturnValue(of({ ...page, items: [], totalItems: 0, totalPages: 0 }));
    fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No audit records');

    audit.list.mockReturnValue(throwError(() => new Error('failed')));
    fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('could not be loaded');
    fixture.componentInstance.retry();
    expect(audit.list).toHaveBeenCalled();
  });

  it('supports pagination', () => {
    const fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    fixture.componentInstance.page(2);
    expect(audit.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
});
