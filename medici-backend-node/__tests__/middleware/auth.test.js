const jwt = require('jsonwebtoken');
const { verifyToken, requireAdmin } = require('../../middleware/auth');

// Mock logger
jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('verifyToken', () => {
    test('should allow requests with valid internal API key', () => {
      req.headers['x-api-key'] = process.env.INTERNAL_API_KEY;

      verifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        id: 'internal',
        email: 'system@medici.internal',
        role: 'admin'
      });
    });

    test('should reject requests with invalid API key', () => {
      req.headers['x-api-key'] = 'wrong-key';

      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('should reject requests with no authorization header', () => {
      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Access denied. No authorization header provided.'
        })
      );
    });

    test('should allow requests with valid JWT Bearer token', () => {
      const token = jwt.sign(
        { id: 1, email: 'test@test.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${token}`;

      verifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ id: 1, email: 'test@test.com', role: 'user' });
    });

    test('should allow requests with raw JWT token (no Bearer prefix)', () => {
      const token = jwt.sign(
        { id: 2, email: 'admin@test.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      req.headers.authorization = token;

      verifyToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ id: 2, role: 'admin' });
    });

    test('should reject requests with expired JWT token', () => {
      const token = jwt.sign(
        { id: 1, email: 'test@test.com' },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );
      req.headers.authorization = `Bearer ${token}`;

      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid or expired token.' })
      );
    });

    test('should reject requests with invalid JWT token', () => {
      req.headers.authorization = 'Bearer invalid.token.here';

      verifyToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdmin', () => {
    test('should allow admin users', () => {
      req.user = { id: 1, role: 'admin' };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should reject non-admin users', () => {
      req.user = { id: 2, role: 'user' };
      req.path = '/test';

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Admin access required.' })
      );
    });

    test('should reject unauthenticated users', () => {
      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Authentication required.' })
      );
    });
  });
});
