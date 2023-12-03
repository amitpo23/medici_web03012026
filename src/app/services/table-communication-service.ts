import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { environment } from '../environments/environment';
import { asObservable } from '../asObservable';

@Injectable()
export class TableCommunicationService {
   private _comm: BehaviorSubject<string> = new BehaviorSubject<string>('');
   
   baseUrl = environment.baseUrl;

    get comm() {
        return asObservable(this._comm);
    }

    constructor(
        private http: HttpClient,
    ){
        this.pollForBuildNumber();
    }

    addItem(newTodo:string):Observable<any> {

        this._comm.next(newTodo);
        return this.comm;      
    }

    private pollForBuildNumber() {

        const pollInterval = 60000;

        timer(pollInterval, pollInterval).subscribe(() => {
            this.http.get(this.baseUrl + 'Misc/Version')
            .subscribe((data: any) => {
                // console.log( data);
                if (data != null) {
                    let currVersion = data.version;
                    let savedVersion = localStorage.getItem('saved_version');
                    if (savedVersion != null && savedVersion != 'undefined' && savedVersion != '') {
                        if (savedVersion != currVersion) {
                            this.addItem(`update_new_version:${currVersion}`);
                        }
                    }
                    localStorage.setItem('saved_version', currVersion);
                }
                
            });
            
        });
    }
}
