const express = require('express');
const request = require('supertest');

// Mock dependencies before requiring the route
jest.mock('../../config/database', () => ({
  getPool: jest.fn()
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { getPool } = require('../../config/database');
const bookingsRouter = require('../../routes/bookings');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/Book', bookingsRouter);
  return app;
}

describe('Bookings Routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  describe('GET /Book/Bookings', () => {
    test('should return bookings with pagination defaults', async () => {
      const mockRecordset = [
        { id: 1, HotelName: 'Test Hotel', startDate: '2026-01-01' }
      ];
      const mockPool = {
        request: () => ({
          input: jest.fn().mockReturnThis(),
          query: jest.fn().mockResolvedValue({ recordset: mockRecordset })
        })
      };
      getPool.mockResolvedValue(mockPool);

      const res = await request(app).get('/Book/Bookings');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRecordset);
    });

    test('should handle database errors', async () => {
      getPool.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app).get('/Book/Bookings');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /Book/UpdatePrice', () => {
    test('should update price with valid input', async () => {
      const mockPool = {
        request: () => ({
          input: jest.fn().mockReturnThis(),
          query: jest.fn().mockResolvedValue({ rowsAffected: [1] })
        })
      };
      getPool.mockResolvedValue(mockPool);

      const res = await request(app)
        .post('/Book/UpdatePrice')
        .send({ id: 1, newPrice: 150 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Price updated' });
    });

    test('should reject missing id', async () => {
      const res = await request(app)
        .post('/Book/UpdatePrice')
        .send({ newPrice: 150 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should reject negative price', async () => {
      const res = await request(app)
        .post('/Book/UpdatePrice')
        .send({ id: 1, newPrice: -50 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('should return 404 when booking not found', async () => {
      const mockPool = {
        request: () => ({
          input: jest.fn().mockReturnThis(),
          query: jest.fn().mockResolvedValue({ rowsAffected: [0] })
        })
      };
      getPool.mockResolvedValue(mockPool);

      const res = await request(app)
        .post('/Book/UpdatePrice')
        .send({ id: 999, newPrice: 100 });

      expect(res.status).toBe(404);
    });
  });
});
