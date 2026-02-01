const { enforceMode, getMode, setMode, MODES } = require('../../middleware/operational-mode');

describe('Operational Mode Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset to default mode
    setMode('WRITE_ENABLED');
    req = { method: 'GET', originalUrl: '/Book/Bookings', headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('getMode / setMode', () => {
    it('should return the current mode', () => {
      expect(getMode()).toBe('WRITE_ENABLED');
    });

    it('should set a valid mode', () => {
      setMode('READ_ONLY');
      expect(getMode()).toBe('READ_ONLY');
    });

    it('should reject invalid modes', () => {
      expect(() => setMode('INVALID')).toThrow('Invalid mode');
    });

    it('should support all three modes', () => {
      for (const mode of Object.keys(MODES)) {
        setMode(mode);
        expect(getMode()).toBe(mode);
      }
    });
  });

  describe('enforceMode middleware', () => {
    it('should allow GET requests in READ_ONLY mode', () => {
      setMode('READ_ONLY');
      req.method = 'GET';
      enforceMode(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block POST requests in READ_ONLY mode', () => {
      setMode('READ_ONLY');
      req.method = 'POST';
      req.originalUrl = '/Opportunity/InsertOpp';
      enforceMode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow POST requests in WRITE_ENABLED mode', () => {
      setMode('WRITE_ENABLED');
      req.method = 'POST';
      req.originalUrl = '/Opportunity/InsertOpp';
      enforceMode(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block purchase routes in WRITE_ENABLED mode', () => {
      setMode('WRITE_ENABLED');
      req.method = 'POST';
      req.originalUrl = '/Book/PreBook';
      enforceMode(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow purchase routes in PURCHASE_ENABLED mode', () => {
      setMode('PURCHASE_ENABLED');
      req.method = 'POST';
      req.originalUrl = '/Book/PreBook';
      enforceMode(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should always allow exempt routes', () => {
      setMode('READ_ONLY');
      req.method = 'POST';
      req.originalUrl = '/health';
      enforceMode(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should always allow sign-in', () => {
      setMode('READ_ONLY');
      req.method = 'POST';
      req.originalUrl = '/sign-in';
      enforceMode(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
