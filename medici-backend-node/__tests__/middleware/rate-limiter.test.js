const { apiLimiter, authLimiter, heavyLimiter } = require('../../middleware/rate-limiter');

describe('Rate Limiter Middleware', () => {
  test('should export apiLimiter', () => {
    expect(apiLimiter).toBeDefined();
    expect(typeof apiLimiter).toBe('function');
  });

  test('should export authLimiter', () => {
    expect(authLimiter).toBeDefined();
    expect(typeof authLimiter).toBe('function');
  });

  test('should export heavyLimiter', () => {
    expect(heavyLimiter).toBeDefined();
    expect(typeof heavyLimiter).toBe('function');
  });
});
