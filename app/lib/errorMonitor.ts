import { supabase } from './supabase';
import { Platform } from 'react-native';

type Severity = 'info' | 'warning' | 'error' | 'critical';

interface ErrorReport {
  message: string;
  errorType?: string;
  stackTrace?: string;
  severity?: Severity;
  userId?: string;
  metadata?: Record<string, any>;
}

class ErrorMonitor {
  private userId: string | null = null;
  private buffer: ErrorReport[] = [];
  private flushTimer: any = null;
  private initialized = false;

  init(userId?: string) {
    this.userId = userId || null;
    if (this.initialized) return;
    this.initialized = true;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureError(event.error || new Error(event.message), {
          source: event.filename,
          line: event.lineno,
          col: event.colno,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        this.captureError(error, { type: 'unhandled_promise_rejection' });
      });
    }
  }

  setUser(userId: string | null) {
    this.userId = userId;
  }

  captureError(error: Error | string, metadata?: Record<string, any>) {
    const report: ErrorReport = {
      message: typeof error === 'string' ? error : error.message,
      errorType: typeof error === 'string' ? 'string_error' : error.name || 'Error',
      stackTrace: typeof error === 'string' ? undefined : error.stack,
      severity: 'error',
      userId: this.userId || undefined,
      metadata: {
        ...metadata,
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
        url: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : undefined,
      },
    };
    this.buffer.push(report);
    this.scheduleFlush();
  }

  captureWarning(message: string, metadata?: Record<string, any>) {
    this.buffer.push({
      message,
      errorType: 'warning',
      severity: 'warning',
      userId: this.userId || undefined,
      metadata: { ...metadata, platform: Platform.OS, timestamp: new Date().toISOString() },
    });
    this.scheduleFlush();
  }

  captureCritical(error: Error | string, metadata?: Record<string, any>) {
    const report: ErrorReport = {
      message: typeof error === 'string' ? error : error.message,
      errorType: typeof error === 'string' ? 'critical_string' : error.name || 'CriticalError',
      stackTrace: typeof error === 'string' ? undefined : error.stack,
      severity: 'critical',
      userId: this.userId || undefined,
      metadata: { ...metadata, platform: Platform.OS, timestamp: new Date().toISOString() },
    };
    this.sendReport(report);
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, 2000);
  }

  private async flush() {
    if (this.buffer.length === 0) return;
    const reports = [...this.buffer];
    this.buffer = [];
    for (const report of reports) {
      await this.sendReport(report);
    }
  }

  private async sendReport(report: ErrorReport) {
    try {
      await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'log_client_error',
          message: report.message,
          errorType: report.errorType,
          stackTrace: report.stackTrace,
          severity: report.severity,
          userId: report.userId,
          metadata: report.metadata,
        },
      });
    } catch {
      // Silently fail - don't create error loops
    }
  }
}

export const errorMonitor = new ErrorMonitor();
