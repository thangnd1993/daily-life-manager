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
  attendanceEnabled: true,
  leaveModeEnabled: false,
  attendanceTimezone: 'Asia/Ho_Chi_Minh',
  defaultDailyWorkMinutes: 240,
};

describe('UserDetailComponent', () => {
  const users = {
    detail: jest.fn(),
    updateStatus: jest.fn(),
    updateAttendanceEnabled: jest.fn(),
    attendance: jest.fn(),
    finance: jest.fn(),
    financeInsights: jest.fn(),
  };

  beforeEach(async () => {
    users.detail.mockReset().mockReturnValue(of(detail));
    users.updateStatus.mockReset().mockReturnValue(of({ ...detail, status: 'SUSPENDED' }));
    users.updateAttendanceEnabled.mockReset().mockReturnValue(of({ ...detail, attendanceEnabled: false }));
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
            workedMinutes: 240,
            status: 'WORKED',
            offReason: null,
          },
        ],
        checkedInDays: 1,
        workedDays: 1,
        totalWorkedMinutes: 240,
        offDays: 0,
        year: 2026,
        month: 8,
      }),
    );
    users.finance.mockReset().mockReturnValue(
      of({
        items: [
          {
            id: 'tx-1',
            type: 'EXPENSE',
            amount: '150000',
            currency: 'VND',
            description: null,
            occurredAt: '2026-08-29T01:00:00Z',
            category: { id: 'food', name: 'Food' },
          },
        ],
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
        summary: { totalIncome: '1000000', totalExpense: '150000', netBalance: '850000', currency: 'VND' },
      }),
    );
    users.financeInsights.mockReset().mockReturnValue(
      of({
        budgets: [
          {
            id: 'budget-1',
            categoryId: null,
            category: null,
            amount: '1000000',
            spentAmount: '150000',
            remainingAmount: '850000',
            percentageUsed: 15,
            exceeded: false,
          },
        ],
        analytics: {
          expenseByCategory: [{ category: { id: 'food', name: 'Food' }, amount: '150000', percentage: 100 }],
          trend: [{ year: 2026, month: 8, totalIncome: '0', totalExpense: '150000', netBalance: '-150000' }],
        },
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

  it('keeps the selected status visible when a status mutation fails', () => {
    users.updateStatus.mockReturnValue(throwError(() => new Error('failed')));
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.requestStatus('SUSPENDED');
    fixture.componentInstance.confirmStatus(detail);
    expect(fixture.componentInstance.saving).toBe(false);
    expect(fixture.componentInstance.pendingStatus).toBe('SUSPENDED');
    expect(fixture.componentInstance.feedback).toContain('could not be updated');
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
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('worked days');
  });

  it('renders attendance empty and error states', () => {
    users.attendance.mockReturnValueOnce(of({ items: [], checkedInDays: 0, year: 2026, month: 8 }));
    let fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No work records');
    users.attendance.mockReturnValueOnce(throwError(() => new Error('failed')));
    fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Attendance could not be loaded');
  });

  it('renders selected-user finance totals and changes month', () => {
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect(users.finance).toHaveBeenCalledWith('user-1', expect.any(Number), expect.any(Number), 1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Food');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1.000.000 ₫');
    fixture.componentInstance.changeFinanceMonth(-1);
    expect(users.finance).toHaveBeenCalledTimes(2);
  });

  it('renders finance empty and error states', () => {
    users.finance.mockReturnValueOnce(
      of({
        items: [],
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
        summary: { totalIncome: '0', totalExpense: '0', netBalance: '0', currency: 'VND' },
      }),
    );
    let fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No transactions');
    users.finance.mockReturnValueOnce(throwError(() => new Error('failed')));
    fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Finance data could not be loaded');
  });

  it('renders budget usage, category analytics, and refreshes them on month change', () => {
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Overall budget');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Expense breakdown');
    fixture.componentInstance.changeFinanceMonth(-1);
    expect(users.financeInsights).toHaveBeenCalledTimes(2);
  });
});
