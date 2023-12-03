import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthSignInComponent } from './components/sign-in/sign-in.component';
import { MaterialModule } from 'src/app/modules/material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthRoutingModule } from './auth.routing.module';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthSignOutComponent } from './components/sign-out/sign-out.component';



@NgModule({
  declarations: [
    AuthSignInComponent,
    AuthSignOutComponent
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule
  ],
  providers: [
    AuthService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class AuthModule { }
