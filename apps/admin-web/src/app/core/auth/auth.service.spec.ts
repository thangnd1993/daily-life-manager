import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const admin = { id: '1', email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN', status: 'ACTIVE' } as const;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AuthService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stores credentials in memory and exposes ADMIN state after login', () => {
    service.login(admin.email, 'password').subscribe();
    http.expectOne('auth/login').flush({ accessToken: 'access', refreshToken: 'refresh', user: admin });
    expect(service.accessToken).toBe('access');
    expect(service.isAdmin()).toBe(true);
  });

  it('rotates credentials through refresh and clears state', () => {
    service.login(admin.email, 'password').subscribe();
    http.expectOne('auth/login').flush({ accessToken: 'access', refreshToken: 'refresh', user: admin });
    service.refresh().subscribe((token) => expect(token).toBe('next-access'));
    http.expectOne('auth/refresh').flush({ accessToken: 'next-access', refreshToken: 'next-refresh', user: admin });
    service.clear();
    expect(service.isAuthenticated()).toBe(false);
  });
});
