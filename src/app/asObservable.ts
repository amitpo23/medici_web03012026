import { Observable, Subject } from "rxjs";

export function asObservable(subject: Subject<string>) {
    return new Observable(fn => subject.subscribe(fn));
}