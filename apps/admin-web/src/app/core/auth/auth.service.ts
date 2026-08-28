import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { Account, AuthResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accountState = signal<Account | null>(null);
  private accessTokenValue: string | null = null;
  private refreshTokenValue: string | null = null;
  private refreshRequest: Observable<string> | null = null;

  readonly account = this.accountState.asReadonly();
  readonly isAuthenticated = computed(() => this.accountState()?.status === 'ACTIVE');
  readonly isAdmin = computed(() => this.isAuthenticated() && this.accountState()?.role === 'ADMIN');

  constructor(private readonly http: HttpClient) {}

  get accessToken(): string | null {
    return this.accessTokenValue;
  }

  login(email: string, password: string): Observable<Account> {
    return this.http.post<AuthResponse>('auth/login', { email, password, deviceName: 'Admin Web' }).pipe(
      tap((response) => this.accept(response)),
      map((response) => response.user),
    );
  }

  loadCurrentUser(): Observable<Account> {
    return this.http.get<Account>('auth/me').pipe(tap((account) => this.accountState.set(account)));
  }

  refresh(): Observable<string> {
    if (!this.refreshTokenValue) throw new Error('No refresh token available');
    if (!this.refreshRequest) {
      this.refreshRequest = this.http.post<AuthResponse>('auth/refresh', { refreshToken: this.refreshTokenValue }).pipe(
        tap((response) => this.accept(response)),
        map((response) => response.accessToken),
        finalize(() => (this.refreshRequest = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshRequest;
  }

  logout(): Observable<void> {
    return this.http.post<void>('auth/logout', {}).pipe(finalize(() => this.clear()));
  }

  clear(): void {
    this.accessTokenValue = null;
    this.refreshTokenValue = null;
    this.accountState.set(null);
  }

  private accept(response: AuthResponse): void {
    this.accessTokenValue = response.accessToken;
    this.refreshTokenValue = response.refreshToken;
    this.accountState.set(response.user);
  }
}
