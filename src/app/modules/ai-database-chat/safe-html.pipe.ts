import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Strips dangerous tags (script, iframe, object, embed, form) and event handlers
 * while preserving safe formatting tags.
 */
@Pipe({
  name: 'safeHtml'
})
export class SafeHtmlPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) {
      return '';
    }

    // Strip dangerous tags and attributes before sanitizing
    let cleaned = value
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers
      .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
      // Remove iframe, object, embed, form tags
      .replace(/<\/?(?:iframe|object|embed|form|input|button)\b[^>]*>/gi, '')
      // Remove javascript: URLs
      .replace(/javascript\s*:/gi, '');

    return this.sanitizer.bypassSecurityTrustHtml(cleaned);
  }
}
