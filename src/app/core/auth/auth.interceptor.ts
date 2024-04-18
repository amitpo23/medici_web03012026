import {Injectable} from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AuthService} from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private _authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let newReq = req.clone();

    // Request
    //
    // If the access token didn't expire, add the Authorization header.
    // We won't add the Authorization header if the access token expired.
    // This will force the server to return a "401 Unauthorized" response
    // for the protected API routes which our response interceptor will
    // catch and delete the access token from the local storage while logging
    // the user out from the app!
    let currentToken = localStorage.getItem('auth');
    if (currentToken != null && currentToken != 'undefined') {
      newReq = req.clone({
        setHeaders: {
          'Authorization': 'Bearer ' + currentToken,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      });
    }
    return next.handle(newReq).pipe(
      catchError((error) => {

        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 400)) {
          this._authService.signOut();
        }

        return throwError(error);
      })
    );
  }
}
