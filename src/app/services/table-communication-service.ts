import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, timer } from 'rxjs';
import { environment } from '../environments/environment';
import { asObservable } from '../asObservable';

@Injectable()
export class TableCommunicationService implements OnDestroy {
   private _comm: BehaviorSubject<string> = new BehaviorSubject<string>('');
   private _pollSubscription: Subscription | null = null;

   baseUrl = environment.baseUrl;

    get comm() {
        return asObservable(this._comm);
    }

    constructor(
        private http: HttpClient,
    ){
        this.pollForBuildNumber();
    }

    ngOnDestroy(): void {
        if (this._pollSubscription) {
            this._pollSubscription.unsubscribe();
        }
    }

    addItem(newTodo: string): void {
        this._comm.next(newTodo);
    }

    private pollForBuildNumber() {
        const pollInterval = 60000;

        this._pollSubscription = timer(pollInterval, pollInterval).subscribe(() => {
            this.http.get(this.baseUrl + 'Misc/Version')
            .subscribe((data: any) => {
                if (data != null) {
                    const currVersion = data.version;
                    const savedVersion = localStorage.getItem('saved_version');
                    if (savedVersion != null && savedVersion !== 'undefined' && savedVersion !== '') {
                        if (savedVersion !== currVersion) {
                            this.addItem(`update_new_version:${currVersion}`);
                        }
                    }
                    localStorage.setItem('saved_version', currVersion);
                }
            });
        });
    }
}
