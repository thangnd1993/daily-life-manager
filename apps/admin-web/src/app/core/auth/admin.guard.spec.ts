import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  it('allows ADMIN and redirects other users', () => {
    const auth = { isAdmin: jest.fn().mockReturnValue(true) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
    const allowed = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(allowed).toBe(true);
    auth.isAdmin.mockReturnValue(false);
    const denied = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(denied).toEqual(TestBed.inject(Router).createUrlTree(['/login']));
  });
});
