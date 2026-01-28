import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AIChatService, ChatMessage, QuickStatsResponse } from '../../services/ai-chat.service';

@Component({
  selector: 'app-ai-database-chat',
  templateUrl: './ai-database-chat.component.html',
  styleUrls: ['./ai-database-chat.component.scss']
})
export class AIDatabaseChatComponent implements OnInit, OnDestroy {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  
  private destroy$ = new Subject<void>();

  // Chat state
  messages: ChatMessage[] = [];
  isLoading = false;
  showSqlQuery = false;
  
  // Form control
  questionControl = new FormControl<string>('');
  
  // Quick stats
  quickStats: QuickStatsResponse['stats'] | null = null;
  isLoadingStats = false;

  // Suggestions
  suggestions: string[] = [
    'כמה הזמנות יש לי היום?',
    'מה הרווח הכולל החודש?',
    'אילו מלונות הכי רווחיים?',
    'כמה הזמנות פעילות יש לי?',
    'מה ממוצע המחיר לחדר?',
    'How many bookings do I have?',
    'What is the total revenue?',
    'Show me top 10 hotels by profit'
  ];

  // Schema visibility
  showSchema = false;
  databaseSchema: any[] = [];
  isLoadingSchema = false;

  constructor(private aiChatService: AIChatService) {}

  ngOnInit(): void {
    this.loadQuickStats();
    this.addWelcomeMessage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Add welcome message
   */
  private addWelcomeMessage(): void {
    const welcomeMessage: ChatMessage = {
      id: this.aiChatService.generateMessageId(),
      role: 'assistant',
      content: `👋 **ברוכים הבאים למערכת AI Database Chat!**

אני כאן לעזור לך לנתח את נתוני ההזמנות והמלונות שלך.

**מה אני יכול לעשות?**
- 📊 ענה על שאלות בשפה טבעית (עברית/אנגלית)
- 🔍 המר שאלות ל-SQL queries אוטומטית
- 💡 קבל תובנות על הזמנות, רווחים, ומלונות
- 🤖 מופעל על ידי **Azure OpenAI + RAG**

**דוגמאות לשאלות:**
- "כמה הזמנות יש לי היום?"
- "מה הרווח הכולל השבוע?"
- "אילו מלונות הכי רווחיים?"

שאל אותי כל שאלה! 🚀`,
      timestamp: new Date()
    };
    
    this.messages.push(welcomeMessage);
  }

  /**
   * Load quick statistics
   */
  loadQuickStats(): void {
    this.isLoadingStats = true;
    this.aiChatService.getQuickStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.quickStats = response.stats;
          }
          this.isLoadingStats = false;
        },
        error: (err) => {
          console.error('Error loading quick stats:', err);
          this.isLoadingStats = false;
        }
      });
  }

  /**
   * Send a question
   */
  sendQuestion(): void {
    const question = this.questionControl.value?.trim();
    if (!question || this.isLoading) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: this.aiChatService.generateMessageId(),
      role: 'user',
      content: question,
      timestamp: new Date()
    };
    this.messages.push(userMessage);
    
    // Clear input
    this.questionControl.setValue('');
    
    // Scroll to bottom
    setTimeout(() => this.scrollToBottom(), 100);
    
    // Send to backend
    this.isLoading = true;
    this.aiChatService.askQuestion({ 
      question,
      conversationHistory: this.messages.slice(-5) // Send last 5 messages for context
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          
          // Add assistant response
          const assistantMessage: ChatMessage = {
            id: this.aiChatService.generateMessageId(),
            role: 'assistant',
            content: response.answer || response.explanation || 'לא נמצאה תשובה.',
            timestamp: new Date(),
            sqlQuery: response.sqlQuery,
            results: response.results
          };
          
          if (response.error) {
            assistantMessage.error = response.error;
            assistantMessage.content = `❌ שגיאה: ${response.error}`;
          }
          
          this.messages.push(assistantMessage);
          setTimeout(() => this.scrollToBottom(), 100);
        },
        error: (err) => {
          this.isLoading = false;
          const errorMessage: ChatMessage = {
            id: this.aiChatService.generateMessageId(),
            role: 'assistant',
            content: `❌ שגיאה בשליחת השאילתא: ${err.message || 'Unknown error'}`,
            timestamp: new Date(),
            error: err.message
          };
          this.messages.push(errorMessage);
          setTimeout(() => this.scrollToBottom(), 100);
        }
      });
  }

  /**
   * Use a suggestion
   */
  useSuggestion(suggestion: string): void {
    this.questionControl.setValue(suggestion);
    this.sendQuestion();
  }

  /**
   * Toggle SQL query visibility
   */
  toggleSqlQuery(): void {
    this.showSqlQuery = !this.showSqlQuery;
  }

  /**
   * Load and toggle database schema
   */
  toggleSchema(): void {
    this.showSchema = !this.showSchema;
    
    if (this.showSchema && this.databaseSchema.length === 0) {
      this.isLoadingSchema = true;
      this.aiChatService.getDatabaseSchema()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.databaseSchema = response.schema;
            }
            this.isLoadingSchema = false;
          },
          error: (err) => {
            console.error('Error loading schema:', err);
            this.isLoadingSchema = false;
          }
        });
    }
  }

  /**
   * Clear chat history
   */
  clearChat(): void {
    this.messages = [];
    this.addWelcomeMessage();
  }

  /**
   * Scroll chat to bottom
   */
  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling:', err);
    }
  }

  /**
   * Handle Enter key press
   */
  onEnterPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendQuestion();
    }
  }

  /**
   * Format number with commas
   */
  formatNumber(num: number): string {
    return num?.toLocaleString('en-US') || '0';
  }

  /**
   * Format currency
   */
  formatCurrency(num: number): string {
    return '$' + (num?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00');
  }
}
