const express = require('express');
const request = require('supertest');

// Mock database
jest.mock('../../config/database', () => ({
  getPool: jest.fn().mockResolvedValue({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{
          TotalReservations: 15,
          TotalRevenue: 25000,
          TotalCost: 18000,
          GrossProfit: 7000,
          AvgMarginPercent: 28.0,
          FirstCheckIn: '2026-01-01',
          LastCheckOut: '2026-01-30'
        }]
      })
    })
  })
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const reportsRoutes = require('../../routes/reports');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/reports', reportsRoutes);
  return app;
}

describe('Reports Routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /reports/ProfitLoss', () => {
    it('should return profit/loss summary', async () => {
      const res = await request(app).get('/reports/ProfitLoss');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('TotalRevenue');
      expect(res.body).toHaveProperty('GrossProfit');
      expect(res.body).toHaveProperty('AvgMarginPercent');
    });

    it('should accept date filters', async () => {
      const res = await request(app)
        .get('/reports/ProfitLoss?startDate=2026-01-01&endDate=2026-01-31');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /reports/MarginByHotel', () => {
    it('should return margin data by hotel', async () => {
      const res = await request(app).get('/reports/MarginByHotel');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /reports/MarginByDate', () => {
    it('should return margin data by date', async () => {
      const res = await request(app).get('/reports/MarginByDate');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /reports/TopHotels', () => {
    it('should return top hotels with default limit', async () => {
      const res = await request(app).get('/reports/TopHotels');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should accept custom limit', async () => {
      const res = await request(app).get('/reports/TopHotels?limit=5');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /reports/LossReport', () => {
    it('should return loss report', async () => {
      const res = await request(app).get('/reports/LossReport');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /reports/OpportunitiesPerformance', () => {
    it('should return opportunities performance', async () => {
      const res = await request(app).get('/reports/OpportunitiesPerformance');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
