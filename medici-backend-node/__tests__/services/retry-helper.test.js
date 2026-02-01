const { withRetry, withConcurrencyLimit } = require('../../services/retry-helper');

// Mock logger
jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Retry Helper', () => {
  describe('withRetry', () => {
    test('should return result on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10, operationName: 'test' });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and return on eventual success', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10, operationName: 'test' });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test('should throw after exhausting all retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelay: 10, operationName: 'test' })
      ).rejects.toThrow('persistent failure');

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    test('should use default options when none provided', async () => {
      const fn = jest.fn().mockResolvedValue('ok');

      const result = await withRetry(fn);

      expect(result).toBe('ok');
    });
  });

  describe('withConcurrencyLimit', () => {
    test('should process all items', async () => {
      const items = [1, 2, 3, 4, 5];
      const fn = jest.fn().mockImplementation(async (item) => item * 2);

      const results = await withConcurrencyLimit(items, fn, 2);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(fn).toHaveBeenCalledTimes(5);
    });

    test('should handle errors gracefully', async () => {
      const items = [1, 2, 3];
      const fn = jest.fn().mockImplementation(async (item) => {
        if (item === 2) throw new Error('item 2 failed');
        return item;
      });

      const results = await withConcurrencyLimit(items, fn, 5);

      expect(results[0]).toBe(1);
      expect(results[1]).toEqual({ error: 'item 2 failed' });
      expect(results[2]).toBe(3);
    });

    test('should respect concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const items = [1, 2, 3, 4, 5, 6];
      const fn = jest.fn().mockImplementation(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrent--;
        return 'done';
      });

      await withConcurrencyLimit(items, fn, 2);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    test('should handle empty items array', async () => {
      const fn = jest.fn();
      const results = await withConcurrencyLimit([], fn, 5);

      expect(results).toEqual([]);
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
