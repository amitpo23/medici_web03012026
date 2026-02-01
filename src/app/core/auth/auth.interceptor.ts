import {Injectable} from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AuthService} from './auth.service';
import {Router} from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private _authService: AuthService,
    private _router: Router
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let newReq = req.clone();

    const currentToken = localStorage.getItem('auth');
    if (currentToken && currentToken !== 'undefined') {
      // Strip 'Bearer ' prefix if already present to avoid duplication
      const token = currentToken.startsWith('Bearer ') ? currentToken.slice(7) : currentToken;
      newReq = req.clone({
        setHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });
    }

    return next.handle(newReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Unauthorized - sign out and redirect to login
          this._authService.signOut();
          this._router.navigate(['/sign-in']);
        } else if (error.status === 403) {
          // Forbidden - user doesn't have permission
          console.error('Access forbidden:', error.url);
        } else if (error.status === 0 || error.status === 503) {
          // Network error or service unavailable
          console.error('Service unavailable or network error');
        }

        return throwError(() => error);
      })
    );
  }
}
