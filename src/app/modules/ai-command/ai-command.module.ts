import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { AICommandRoutingModule } from './ai-command-routing.module';
import { AICommandComponent } from './ai-command.component';

@NgModule({
  declarations: [
    AICommandComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    AICommandRoutingModule
  ]
})
export class AICommandModule { }
