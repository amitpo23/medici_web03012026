import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../environments/environment';

export interface SocketNotification {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private notifications$ = new Subject<SocketNotification>();
  private connectionStatus$ = new Subject<boolean>();

  constructor() {
    this.connect();
  }

  private connect(): void {
    try {
      this.socket = io(environment.apiUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('[Socket.IO] Connected to server');
        this.connectionStatus$.next(true);
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('[Socket.IO] Disconnected:', reason);
        this.connectionStatus$.next(false);
      });

      this.socket.on('connect_error', (error: Error) => {
        console.warn('[Socket.IO] Connection error:', error.message);
        this.connectionStatus$.next(false);
      });

      // Listen for all notification events
      const events = [
        'new-booking',
        'booking-cancelled',
        'new-opportunity',
        'alert-triggered',
        'log-entry'
      ];

      for (const event of events) {
        this.socket.on(event, (data: Record<string, unknown>) => {
          this.notifications$.next({
            event,
            data,
            timestamp: (data['timestamp'] as string) || new Date().toISOString()
          });
        });
      }
    } catch (error) {
      console.error('[Socket.IO] Failed to initialize:', error);
    }
  }

  /**
   * Get observable stream of notifications
   */
  getNotifications(): Observable<SocketNotification> {
    return this.notifications$.asObservable();
  }

  /**
   * Get observable stream of connection status
   */
  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Manually reconnect
   */
  reconnect(): void {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.socket?.disconnect();
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
    this.notifications$.complete();
    this.connectionStatus$.complete();
  }
}
