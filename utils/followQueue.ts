/**
 * Manages a queue of follow actions with randomized delays.
 */
import { sleepRandom } from "./index";
export type QueueStatus = 'idle' | 'running' | 'paused' | 'stopped';

export interface FollowTask {
  handle: string;
  onExecute: () => Promise<boolean>;
}

export class FollowQueue {
  private queue: FollowTask[] = [];
  private status: QueueStatus = 'idle';
  private processedCount = 0;
  private successCount = 0;

  // Configuration
  private minDelay = 1000;
  private maxDelay = 3000;

  constructor(options?: { minDelay?: number; maxDelay?: number; }) {
    if (options?.minDelay) this.minDelay = options.minDelay;
    if (options?.maxDelay) this.maxDelay = options.maxDelay;
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

  private async process() {
    while (this.status === 'running') {
      const task = this.queue.shift();
      if (!task) {
        await sleepRandom(500, 2000);
        continue;
      }

      try {
        const success = await task.onExecute();
        this.processedCount++;
        if (success) this.successCount++;

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
