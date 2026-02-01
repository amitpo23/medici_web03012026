const requestId = require('../../middleware/request-id');

describe('Request ID Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      setHeader: jest.fn()
    };
    next = jest.fn();
  });

  test('should generate a UUID request ID when none is provided', () => {
    requestId(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    // UUID v4 format
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  test('should use incoming X-Request-ID header if provided', () => {
    req.headers['x-request-id'] = 'external-trace-id-123';

    requestId(req, res, next);

    expect(req.requestId).toBe('external-trace-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'external-trace-id-123');
    expect(next).toHaveBeenCalled();
  });

  test('should produce unique IDs for different requests', () => {
    const ids = new Set();

    for (let i = 0; i < 100; i++) {
      const r = { headers: {} };
      const s = { setHeader: jest.fn() };
      const n = jest.fn();
      requestId(r, s, n);
      ids.add(r.requestId);
    }

    expect(ids.size).toBe(100);
  });
});
