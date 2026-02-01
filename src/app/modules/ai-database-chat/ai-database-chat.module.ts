import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { AIDatabaseChatRoutingModule } from './ai-database-chat-routing.module';
import { AIDatabaseChatComponent } from './ai-database-chat.component';
import { SafeHtmlPipe } from './safe-html.pipe';

@NgModule({
  declarations: [
    AIDatabaseChatComponent,
    SafeHtmlPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    AIDatabaseChatRoutingModule
  ]
})
export class AIDatabaseChatModule { }
