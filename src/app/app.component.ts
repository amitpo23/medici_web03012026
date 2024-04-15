import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'only-night-app';

  constructor(public router: Router) { }

  isActive(): boolean {
    return this.router.url.indexOf('/sign-in') === -1;
  }
}
