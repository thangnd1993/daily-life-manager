import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UserDetailComponent } from './user-detail.component';
import { UsersService } from './users.service';

const detail = {
  id: 'user-1',
  email: 'alex@example.com',
  displayName: 'Alex',
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: '2026-08-29T00:00:00Z',
  updatedAt: '2026-08-29T00:00:00Z',
  activeSessionCount: 2,
};

describe('UserDetailComponent', () => {
  const users = { detail: jest.fn(), updateStatus: jest.fn() };

  beforeEach(async () => {
    users.detail.mockReset().mockReturnValue(of(detail));
    users.updateStatus.mockReset().mockReturnValue(of({ ...detail, status: 'SUSPENDED' }));
    await TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'user-1' } } } },
      ],
    }).compileComponents();
  });

  it('loads detail and confirms a status action', () => {
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Alex');
    fixture.componentInstance.requestStatus('SUSPENDED');
    fixture.componentInstance.confirmStatus(detail);
    expect(users.updateStatus).toHaveBeenCalledWith('user-1', 'SUSPENDED');
    expect(fixture.componentInstance.feedback).toContain('updated');
  });

  it('renders detail loading errors', () => {
    users.detail.mockReturnValue(throwError(() => new Error('failed')));
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('could not be loaded');
  });
});
