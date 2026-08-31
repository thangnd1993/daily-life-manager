import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { DashboardSummary, DashboardTrends } from './dashboard.models';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from './dashboard.service';

const summary: DashboardSummary = {
  generatedAt: '2026-08-31T10:00:00Z',
  users: {
    total: 12,
    active: 10,
    inactive: 1,
    suspended: 1,
    admins: 1,
    members: 11,
    registeredLast7Days: 3,
    registeredLast30Days: 6,
    recentlyActive: 9,
  },
  attendance: { checkInsToday: 7, uniqueUsersToday: 7, participantsThisMonth: 10 },
  finance: {
    transactionCountThisMonth: 24,
    totalIncomeThisMonth: '12500000',
    totalExpenseThisMonth: '8200000',
    activeUsersThisMonth: 8,
    usersWithOverallBudget: 4,
    usersOverOverallBudget: 1,
    currency: 'VND',
  },
  gold: {
    latestSnapshotAt: '2026-08-31T09:00:00Z',
    provider: 'SJC',
    activeAlerts: 5,
    usersWithActiveAlerts: 3,
    triggersLast24Hours: 2,
    triggersLast7Days: 6,
  },
  notifications: {
    createdLast24Hours: 2,
    createdLast7Days: 8,
    sentLast7Days: 6,
    partialLast7Days: 1,
    failedLast7Days: 1,
    activeDevices: 9,
    inactiveDevices: 2,
  },
};

const points = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-08-${25 + index}`,
  count: index,
}));
const trends: DashboardTrends = {
  windowDays: 7,
  startDate: '2026-08-25',
  endDate: '2026-08-31',
  registrations: points,
  attendance: points,
  goldAlertTriggers: points,
  notifications: points,
  recentActivity: {
    registrations: [{ displayName: 'Alex', createdAt: '2026-08-31T08:00:00Z' }],
    attendance: [],
    goldAlertTriggers: [],
  },
};

describe('DashboardComponent', () => {
  const dashboard = { summary: jest.fn(), trends: jest.fn() };

  beforeEach(async () => {
    dashboard.summary.mockReset().mockReturnValue(of(summary));
    dashboard.trends.mockReset().mockReturnValue(of(trends));
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: DashboardService, useValue: dashboard }],
    }).compileComponents();
  });

  it('renders summary cards, finance totals, and labelled trend values', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Total users');
    expect(element.textContent).toContain('12');
    expect(element.textContent).toContain('12.500.000 ₫');
    expect(element.textContent).toContain('Seven-day activity');
    expect(element.querySelectorAll('.bar')).toHaveLength(7);
    expect(element.textContent).toContain('Alex');
  });

  it('renders loading state while both resources are pending', () => {
    dashboard.summary.mockReturnValue(new Subject<DashboardSummary>());
    dashboard.trends.mockReturnValue(new Subject<DashboardTrends>());
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading dashboard summary');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading seven-day trends');
  });

  it('keeps trends visible when summary fails and retries the failed panel', () => {
    dashboard.summary.mockReturnValue(throwError(() => new Error('failed')));
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Summary is temporarily unavailable');
    expect(element.textContent).toContain('Seven-day activity');
    fixture.componentInstance.retrySummary();
    expect(dashboard.summary).toHaveBeenCalledTimes(2);
  });

  it('renders a stable empty activity state', () => {
    dashboard.trends.mockReturnValue(
      of({
        ...trends,
        recentActivity: { registrations: [], attendance: [], goldAlertTriggers: [] },
      }),
    );
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No recent activity');
  });
});
