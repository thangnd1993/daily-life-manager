import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [UsersService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps list filters, paging, and sorting to query parameters', () => {
    service
      .list({
        page: 2,
        pageSize: 25,
        search: 'alex',
        role: 'USER',
        status: 'ACTIVE',
        sortBy: 'email',
        sortDirection: 'asc',
      })
      .subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === 'admin/users' && candidate.params.get('search') === 'alex',
    );
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('role')).toBe('USER');
    expect(request.request.params.get('status')).toBe('ACTIVE');
    expect(request.request.params.get('sortBy')).toBe('email');
    request.flush({ items: [], page: 2, pageSize: 25, totalItems: 0, totalPages: 0 });
  });

  it('loads detail and updates status', () => {
    service.detail('user-1').subscribe();
    http.expectOne('admin/users/user-1').flush({ id: 'user-1' });
    service.updateStatus('user-1', 'SUSPENDED').subscribe();
    const request = http.expectOne('admin/users/user-1/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'SUSPENDED' });
    request.flush({ id: 'user-1', status: 'SUSPENDED' });
  });
});
