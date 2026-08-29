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
  const users = { detail: jest.fn(), updateStatus: jest.fn(), attendance: jest.fn() };

  beforeEach(async () => {
    users.detail.mockReset().mockReturnValue(of(detail));
    users.updateStatus.mockReset().mockReturnValue(of({ ...detail, status: 'SUSPENDED' }));
    users.attendance.mockReset().mockReturnValue(
      of({
        items: [
          {
            id: 'attendance-1',
            attendanceDate: '2026-08-29',
            checkedInAt: '2026-08-29T01:00:00Z',
            timezone: 'Asia/Ho_Chi_Minh',
            source: 'MOBILE',
            note: null,
          },
        ],
        checkedInDays: 1,
        year: 2026,
        month: 8,
      }),
    );
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

  it('loads attendance and changes month without nested subscriptions', () => {
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect(users.attendance).toHaveBeenCalledWith('user-1', expect.any(Number), expect.any(Number));
    fixture.componentInstance.changeAttendanceMonth(-1);
    expect(users.attendance).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('checked-in days');
  });

  it('renders attendance empty and error states', () => {
    users.attendance.mockReturnValueOnce(of({ items: [], checkedInDays: 0, year: 2026, month: 8 }));
    let fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No check-ins');
    users.attendance.mockReturnValueOnce(throwError(() => new Error('failed')));
    fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Attendance could not be loaded');
  });
});
