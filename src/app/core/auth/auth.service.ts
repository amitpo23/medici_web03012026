import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserService } from 'src/app/services/user.service';
import { Observable, throwError, switchMap, of } from 'rxjs';
import { environment } from 'src/app/environments/environment';
import { AuthUtils } from './auth.utils';

@Injectable({
  providedIn: 'root'
})
export class AuthService
{
    private _authenticated: boolean = false;
    baseUrl = environment.baseUrl;

    constructor(
        private _httpClient: HttpClient,
        private _userService: UserService
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    set accessToken(token: string)
    {
        localStorage.setItem('accessToken', token);
    }

    get accessToken(): string
    {
        const currentAccessToken = localStorage.getItem('accessToken');
        if (!currentAccessToken || currentAccessToken === 'undefined') {
            return '';
        }
        return currentAccessToken;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    forgotPassword(_email: string): Observable<unknown>
    {
        // Not yet implemented on backend
        return throwError(() => new Error('Forgot password is not yet available.'));
    }

    resetPassword(_password: string): Observable<unknown>
    {
        // Not yet implemented on backend
        return throwError(() => new Error('Reset password is not yet available.'));
    }

    /**
     * Sign in using server-issued JWT token only.
     * No client-side JWT generation - tokens come from the backend /sign-in endpoint.
     */
    signIn(credentials: { email: string; password: string }): Observable<unknown>
    {
        if ( this._authenticated )
        {
            return throwError(() => new Error('User is already logged in.'));
        }

        return this._httpClient.post(
             this.baseUrl + 'sign-in',
        credentials).pipe(
            switchMap((response: any) => {
                // Store the server-issued token (not client-generated)
                const serverToken = response.authorization;
                if (serverToken) {
                    // Strip 'Bearer ' prefix if present for storage
                    const token = serverToken.startsWith('Bearer ') ? serverToken.slice(7) : serverToken;
                    this.accessToken = token;
                }

                this._authenticated = true;

                this._userService.user = response.user;
                this._userService.signedUser = response.user;

                localStorage.setItem('auth', response.authorization);
                localStorage.setItem('signedUser', JSON.stringify(response.user));

                return of(response);
            })
        );
    }

    signOut(): Observable<unknown>
    {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('auth');
        localStorage.removeItem('signedUser');

        this._authenticated = false;

        return of(true);
    }

    signUp(_user: { name: string; email: string; password: string; company: string }): Observable<unknown>
    {
        // Not yet implemented on backend
        return throwError(() => new Error('Sign up is not yet available.'));
    }

    unlockSession(_credentials: { email: string; password: string }): Observable<unknown>
    {
        // Not yet implemented on backend
        return throwError(() => new Error('Unlock session is not yet available.'));
    }

    /**
     * Check the authentication status
     */
    check(): Observable<boolean>
    {
        if ( this._authenticated )
        {
            return of(true);
        }

        if ( !this.accessToken )
        {
            return of(false);
        }

        if ( AuthUtils.isTokenExpired(this.accessToken) )
        {
            return of(false);
        }

        // User has a valid, non-expired token in storage
        this._authenticated = true;

        // Restore user from localStorage
        try {
            const savedUser = localStorage.getItem('signedUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                this._userService.user = user;
                this._userService.signedUser = user;
            }
        } catch {
            // If parsing fails, token is invalid
            this._authenticated = false;
            return of(false);
        }

        return of(true);
    }
}
