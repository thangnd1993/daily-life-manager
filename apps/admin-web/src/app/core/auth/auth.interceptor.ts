import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isPublicAuthRequest = /auth\/(login|register|refresh|forgot-password|reset-password)$/.test(request.url);
  const authorized = auth.accessToken
    ? request.clone({ setHeaders: { Authorization: `Bearer ${auth.accessToken}` } })
    : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isPublicAuthRequest) {
        return throwError(() => error);
      }
      try {
        return auth.refresh().pipe(
          switchMap((token) => next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
          catchError((refreshError: unknown) => {
            auth.clear();
            void router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      } catch {
        auth.clear();
        void router.navigate(['/login']);
        return throwError(() => error);
      }
    }),
  );
};
