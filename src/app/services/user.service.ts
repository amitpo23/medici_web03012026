import { Injectable } from '@angular/core';
import { ReplaySubject, Observable, of } from 'rxjs';
import { User } from '../core/models/user';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private _user: ReplaySubject<User> = new ReplaySubject<User>(1);
  signedUser: User | null = null;

  set user(value: User) {
    this._user.next(value);
  }

  get user$(): Observable<User> {
    return this._user.asObservable();
  }

  get(): Observable<User> {
    if (this.signedUser) {
      this._user.next(this.signedUser);
      return of(this.signedUser);
    }

    try {
      const saved = localStorage.getItem('signedUser');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.signedUser = parsed;
        this._user.next(parsed);
        return of(parsed);
      }
    } catch {
      // Parsing failed
    }

    return this._user.asObservable();
  }

  update(user: User): Observable<User> {
    this._user.next(user);
    this.signedUser = user;
    localStorage.setItem('signedUser', JSON.stringify(user));
    return of(user);
  }
}
