import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../config/environment';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  if (/^https?:\/\//.test(request.url)) return next(request);
  return next(request.clone({ url: `${environment.apiUrl}/${request.url.replace(/^\//, '')}` }));
};
