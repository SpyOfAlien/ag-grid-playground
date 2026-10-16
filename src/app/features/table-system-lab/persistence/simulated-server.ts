import { signal } from '@angular/core';
export class SimulatedServer {
  readonly delay = signal(600);
  readonly failNext = signal(false);
  readonly submissions = signal(0);
  async persist<T>(accepted: T, abort: AbortSignal): Promise<T> {
    this.submissions.update((n) => n + 1);
    const fails = this.failNext();
    this.failNext.set(false);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        abort.removeEventListener('abort', cancel);
        fails
          ? reject(new Error('Simulated server rejected the save. Retry deliberately.'))
          : resolve(accepted);
      }, this.delay());
      const cancel = () => {
        clearTimeout(timer);
        reject(new Error('Aborted obsolete request'));
      };
      abort.addEventListener('abort', cancel, { once: true });
    });
  }
}
