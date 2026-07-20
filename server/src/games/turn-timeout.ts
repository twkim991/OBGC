export class TurnDeadlineController {
  private generation = 0;

  constructor(
    private readonly schedule: (callback: () => void, delayMs: number) => void,
    private readonly setDeadline: (deadlineAt: number) => void,
  ) {}

  arm(delayMs: number, onExpire: () => void) {
    const generation = ++this.generation;
    this.setDeadline(Date.now() + delayMs);
    this.schedule(() => {
      if (generation !== this.generation) return;
      this.setDeadline(0);
      onExpire();
    }, delayMs);
  }

  clear() {
    this.generation += 1;
    this.setDeadline(0);
  }
}
