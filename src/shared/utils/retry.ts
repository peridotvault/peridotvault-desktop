/**
 * Retry utility with exponential backoff and circuit breaker pattern
 * For peridot-desktop project
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

/**
 * Check if an error is retryable (network errors, 5xx status codes, rate limits)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('abort') ||
      message.includes('connection')
    ) {
      return true;
    }
    // Retry on 5xx errors and 429 rate limit
    if (
      message.includes('503') ||
      message.includes('502') ||
      message.includes('504') ||
      message.includes('429') ||
      message.includes('service unavailable') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    shouldRetry = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt >= maxRetries) {
        throw error;
      }

      // Check if this error should be retried
      if (!shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
        maxDelayMs
      );

      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern to temporarily pause requests when service is failing
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 30000,
    private readonly name = 'CircuitBreaker'
  ) {}

  /**
   * Check if the circuit is open (failing)
   */
  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if we should try half-open
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime > this.resetTimeoutMs
      ) {
        this.state = 'half-open';
        console.log(`[${this.name}] Circuit entering half-open state`);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
      console.log(`[${this.name}] Circuit closed - service recovered`);
    } else {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.warn(
        `[${this.name}] Circuit opened after ${this.failures} failures`
      );
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(
        `[${this.name}] Circuit is open - service temporarily unavailable`
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}
