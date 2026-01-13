import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AuthService } from './core/auth/auth.service';
import { AuthModule } from './core/auth/auth.module';
import { MaterialModule } from './modules/material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TableCommunicationService } from './services/table-communication-service';
import { MAT_RIPPLE_GLOBAL_OPTIONS } from '@angular/material/core';
import { LOADING_BAR_CONFIG } from '@ngx-loading-bar/core';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    AuthModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule
  ],
  providers: [TableCommunicationService,
    {
      provide: LOADING_BAR_CONFIG,
      useValue: { latencyThreshold: 100 }
    },
    {
      provide: MAT_RIPPLE_GLOBAL_OPTIONS,
      useValue: {
        disabled: true,
        animation: {
          enterDuration: 300,
          exitDuration: 0
        }
      }
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
