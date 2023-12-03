import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ReplaySubject, Observable, tap, map } from 'rxjs';
import { User } from '../core/models/user';

@Injectable({
  providedIn: 'root'
})
export class UserService
{
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);
    signedUser: any;

    /**
     * Constructo
     */
    constructor(private _httpClient: HttpClient)
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for user
     *
     * @param value
     */
    set user(value: User)
    {
        // Store the value
        this._user.next(value);
    }

    get user$(): Observable<User>
    {
        return this._user.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get the current logged in user data
     */
    get(): Observable<User>
    {
        // return this._user.asObservable();
        return this._httpClient.get<User>('api/common/user').pipe(
            tap((user) => {
                if (this.signedUser != null) {
                    this._user.next(this.signedUser);
                }
                else {
                    this._user.next(user);
                }
                
            })
        );
    }

    /**
     * Update the user
     *
     * @param user
     */
    update(user: User): Observable<any>
    {
        return this._httpClient.patch<User>('api/common/user', {user}).pipe(
            map((response) => {
                this._user.next(response);
            })
        );
    }
}
