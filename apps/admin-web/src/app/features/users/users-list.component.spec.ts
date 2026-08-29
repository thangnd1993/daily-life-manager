import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UsersListComponent } from './users-list.component';
import { UsersService } from './users.service';

describe('UsersListComponent', () => {
  const users = {
    list: jest.fn(),
  };

  beforeEach(async () => {
    users.list.mockReset();
    users.list.mockReturnValue(
      of({
        items: [
          {
            id: 'user-1',
            email: 'alex@example.com',
            displayName: 'Alex',
            role: 'USER',
            status: 'ACTIVE',
            emailVerifiedAt: null,
            lastLoginAt: null,
            createdAt: '2026-08-29T00:00:00Z',
            updatedAt: '2026-08-29T00:00:00Z',
          },
        ],
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      }),
    );
    await TestBed.configureTestingModule({
      imports: [UsersListComponent],
      providers: [provideRouter([]), { provide: UsersService, useValue: users }],
    }).compileComponents();
  });

  it('loads and renders users', fakeAsync(() => {
    const fixture = TestBed.createComponent(UsersListComponent);
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    expect(users.list).toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Alex');
  }));

  it('debounces search and supports filter, paging, and sorting changes', fakeAsync(() => {
    const fixture = TestBed.createComponent(UsersListComponent);
    fixture.detectChanges();
    fixture.componentInstance.search.setValue('alex');
    tick(300);
    fixture.componentInstance.role.setValue('USER');
    fixture.componentInstance.sortBy('email');
    fixture.componentInstance.page(2);
    fixture.detectChanges();
    expect(users.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'alex', role: 'USER' }));
  }));

  it('renders an error and retries', fakeAsync(() => {
    users.list.mockReturnValue(throwError(() => new Error('failed')));
    const fixture = TestBed.createComponent(UsersListComponent);
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('could not be loaded');
    fixture.componentInstance.retry();
    expect(users.list).toHaveBeenCalledTimes(2);
  }));
});
