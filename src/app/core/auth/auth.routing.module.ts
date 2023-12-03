import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthSignInComponent } from './components/sign-in/sign-in.component';
import { AuthSignOutComponent } from './components/sign-out/sign-out.component';
import { NoAuthGuard } from './guards/noAuth.guard';

const routes: Routes = [
  {
    path: 'sign-in',
    component: AuthSignInComponent,
    canActivate: [NoAuthGuard],
    canActivateChild: [NoAuthGuard],
  },
  {
    path: 'sign-out',
    component: AuthSignOutComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule {

}
