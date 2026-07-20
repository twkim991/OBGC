import { TurnDeadlineController } from './turn-timeout';

describe('TurnDeadlineController', () => {
  afterEach(() => jest.restoreAllMocks());

  it('publishes a deadline and ignores superseded callbacks', () => {
    const callbacks: Array<() => void> = [];
    const deadlines: number[] = [];
    const expired: string[] = [];
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const controller = new TurnDeadlineController(
      (callback) => callbacks.push(callback),
      (deadlineAt) => deadlines.push(deadlineAt),
    );

    controller.arm(10_000, () => expired.push('old'));
    controller.arm(20_000, () => expired.push('current'));
    callbacks[0]();
    callbacks[1]();

    expect(deadlines).toEqual([11_000, 21_000, 0]);
    expect(expired).toEqual(['current']);
  });

  it('clears an armed deadline', () => {
    const callbacks: Array<() => void> = [];
    const deadlines: number[] = [];
    const expired = jest.fn();
    const controller = new TurnDeadlineController(
      (callback) => callbacks.push(callback),
      (deadlineAt) => deadlines.push(deadlineAt),
    );

    controller.arm(1_000, expired);
    controller.clear();
    callbacks[0]();

    expect(deadlines.at(-1)).toBe(0);
    expect(expired).not.toHaveBeenCalled();
  });
});
