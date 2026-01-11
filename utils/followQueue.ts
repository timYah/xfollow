/**
 * Manages a queue of follow actions with randomized delays.
 */
import { sleepRandom } from "./index";
import { setRateLimitState, clearRateLimitState, incrementDailyFollowCount, isDailyLimitReached, setDailyLimitState, clearDailyLimitState } from "./storage";
export type QueueStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'rate_limited' | 'daily_limit_reached';

export interface FollowTask {
  handle: string;
  onExecute: () => Promise<boolean>;
}

export class FollowQueue {
  private queue: FollowTask[] = [];
  private status: QueueStatus = 'idle';
  private processedCount = 0;
  private successCount = 0;
  private successSinceLastPause = 0;
  private resumeTimer: NodeJS.Timeout | null = null;
  private pauseUntil: number | null = null;
  private todayFollowCount = 0;
  private dailyLimitTimer: NodeJS.Timeout | null = null;

  // Configuration
  private minDelay = 1000;
  private maxDelay = 3000;
  private pauseThreshold = 10;
  private pauseDuration = 600000;
  private dailyLimit = 100;

  constructor(options?: { minDelay?: number; maxDelay?: number; rateLimitThreshold?: number; rateLimitDuration?: number; dailyFollowLimit?: number; }) {
    if (options?.minDelay) this.minDelay = options.minDelay;
    if (options?.maxDelay) this.maxDelay = options.maxDelay;
    if (options?.rateLimitThreshold) this.pauseThreshold = options.rateLimitThreshold;
    if (options?.rateLimitDuration) this.pauseDuration = options.rateLimitDuration;
    if (options?.dailyFollowLimit) this.dailyLimit = options.dailyFollowLimit;
  }

  public add(task: FollowTask) {
    if (this.queue.some(t => t.handle === task.handle)) return; // Avoid duplicates
    this.queue.push(task);
  }

  public async start() {
    if (this.status === 'running') return;
    this.status = 'running';
    this.process();
  }

  public pause() {
    this.status = 'paused';
  }

  public stop() {
    this.status = 'stopped';
    this.queue = [];
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    if (this.dailyLimitTimer) {
      clearTimeout(this.dailyLimitTimer);
      this.dailyLimitTimer = null;
    }
  }

  public getStats() {
    return {
      total: this.queue.length + this.processedCount,
      remaining: this.queue.length,
      processed: this.processedCount,
      success: this.successCount,
      status: this.status
    };
  }

  public updateRateLimitConfig(threshold: number, duration: number): void {
    this.pauseThreshold = threshold;
    this.pauseDuration = duration;
  }

  public getRateLimitInfo() {
    const isRateLimited = this.status === 'rate_limited';
    return {
      isRateLimited,
      pauseUntil: isRateLimited ? this.pauseUntil : null,
      remainingMs: isRateLimited && this.pauseUntil ? Math.max(0, this.pauseUntil - Date.now()) : null,
      threshold: this.pauseThreshold,
      duration: this.pauseDuration,
      successSincePause: this.successSinceLastPause
    };
  }

  public async resumeAfterRateLimit(): Promise<void> {
    this.successSinceLastPause = 0;
    this.status = 'running';
    this.pauseUntil = null;
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }

  public async enterRateLimitState(pauseUntil: number, successCount: number): Promise<void> {
    this.status = 'rate_limited';
    this.pauseUntil = pauseUntil;
    this.successSinceLastPause = successCount;
    const remainingMs = pauseUntil - Date.now();
    if (remainingMs > 0) {
      await new Promise<void>(resolve => {
        this.resumeTimer = setTimeout(() => {
          this.resumeTimer = null;
          this.successSinceLastPause = 0;
          this.pauseUntil = null;
          this.status = 'running';
          resolve();
        }, remainingMs);
      });
    }
  }

  public updateDailyLimit(limit: number): void {
    this.dailyLimit = limit;
  }

  public getDailyLimitInfo() {
    return {
      isDailyLimited: this.status === 'daily_limit_reached',
      todayCount: this.todayFollowCount,
      limit: this.dailyLimit,
      remaining: Math.max(0, this.dailyLimit - this.todayFollowCount),
      resetAt: this.status === 'daily_limit_reached' ? this.getMidnightTimestamp() : null,
    };
  }

  public async resumeFromDailyLimit(): Promise<void> {
    this.todayFollowCount = 0;
    this.status = 'running';
    if (this.dailyLimitTimer) {
      clearTimeout(this.dailyLimitTimer);
      this.dailyLimitTimer = null;
    }
  }

  private getMidnightTimestamp(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  private async handleDailyLimitReached() {
    this.status = 'daily_limit_reached';
    const midnight = this.getMidnightTimestamp();
    await setDailyLimitState({
      isLimited: true,
      limitReachedAt: Date.now()
    });

    const timeUntilMidnight = midnight - Date.now();

    await new Promise<void>(resolve => {
      this.dailyLimitTimer = setTimeout(async () => {
        this.dailyLimitTimer = null;
        this.todayFollowCount = 0;
        this.status = 'running';
        await clearDailyLimitState();
        resolve();
      }, timeUntilMidnight);
    });
  }

  private async process() {
    while (this.status === 'running' || this.status === 'rate_limited') {
      // Handle rate limit wait
      if (this.status === 'rate_limited') {
        await new Promise<void>(resolve => {
          this.resumeTimer = setTimeout(() => {
            this.resumeTimer = null;
            resolve();
          }, this.pauseDuration);
        });
        
        // Reset counter and resume
        this.successSinceLastPause = 0;
        await clearRateLimitState();
        this.status = 'running';
        continue;
      }

      const task = this.queue.shift();
      if (!task) {
        await sleepRandom(500, 2000);
        continue;
      }

      try {
        const success = await task.onExecute();
        this.processedCount++;
        if (success) {
          this.successCount++;
          this.successSinceLastPause++;

          await incrementDailyFollowCount();
          this.todayFollowCount++;

          if (this.todayFollowCount >= this.dailyLimit) {
            await this.handleDailyLimitReached();
            continue;
          }

          if (this.successSinceLastPause >= this.pauseThreshold) {
            this.status = 'rate_limited';
            this.pauseUntil = Date.now() + this.pauseDuration;
            await setRateLimitState({
              pauseUntil: this.pauseUntil,
              successSinceLastPause: this.successSinceLastPause
            });
            continue;
          }
        }

        // Wait for a random delay before next task
        if (this.queue.length > 0) {
          const delay = Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Error processing follow for ${task.handle}:`, error);
        this.processedCount++;
      }
    }

    if (this.queue.length === 0) {
      this.status = 'idle';
    }
  }
}
