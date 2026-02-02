/**
 * Revenue Analytics API Routes
 * Provides comprehensive revenue and profit analysis endpoints
 */

const express = require('express');
const router = express.Router();
const revenueAnalytics = require('../services/revenue-analytics');
const logger = require('../config/logger');

/**
 * GET /revenue-analytics/kpis
 * Get key performance indicators
 */
router.get('/kpis', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const kpis = await revenueAnalytics.getKPIs(days);
    
    res.json({
      success: true,
      period_days: days,
      kpis
    });
  } catch (error) {
    logger.error('Failed to get KPIs', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve KPIs'
    });
  }
});

/**
 * GET /revenue-analytics/daily
 * Get daily P&L summary
 */
router.get('/daily', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const endDate = new Date();
    const startDate = new Date(endDate - days * 24 * 60 * 60 * 1000);
    
    const summary = await revenueAnalytics.getDailySummary(startDate, endDate);
    
    res.json({
      success: true,
      period: {
        start: startDate,
        end: endDate,
        days: days
      },
      total_days: summary.length,
      summary
    });
  } catch (error) {
    logger.error('Failed to get daily summary', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve daily summary'
    });
  }
});

/**
 * GET /revenue-analytics/by-city
 * Get revenue breakdown by city
 */
router.get('/by-city', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const breakdown = await revenueAnalytics.getRevenueByCity(days);
    
    res.json({
      success: true,
      period_days: days,
      total_cities: breakdown.length,
      breakdown
    });
  } catch (error) {
    logger.error('Failed to get revenue by city', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve revenue by city'
    });
  }
});

/**
 * GET /revenue-analytics/by-hotel
 * Get revenue breakdown by hotel (top 20)
 */
router.get('/by-hotel', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const breakdown = await revenueAnalytics.getRevenueByHotel(days);
    
    res.json({
      success: true,
      period_days: days,
      total_hotels: breakdown.length,
      breakdown
    });
  } catch (error) {
    logger.error('Failed to get revenue by hotel', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve revenue by hotel'
    });
  }
});

/**
 * GET /revenue-analytics/by-supplier
 * Get revenue breakdown by supplier
 */
router.get('/by-supplier', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const breakdown = await revenueAnalytics.getRevenueBySupplier(days);
    
    res.json({
      success: true,
      period_days: days,
      total_suppliers: breakdown.length,
      breakdown
    });
  } catch (error) {
    logger.error('Failed to get revenue by supplier', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve revenue by supplier'
    });
  }
});

/**
 * GET /revenue-analytics/forecast
 * Get revenue forecast
 */
router.get('/forecast', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const forecast = await revenueAnalytics.getForecast(days);
    
    res.json({
      success: true,
      forecast
    });
  } catch (error) {
    logger.error('Failed to get forecast', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve forecast'
    });
  }
});

/**
 * GET /revenue-analytics/top-performers
 * Get top performing cities and hotels
 */
router.get('/top-performers', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    
    const performers = await revenueAnalytics.getTopPerformers(days, limit);
    
    res.json({
      success: true,
      period_days: days,
      limit: limit,
      performers
    });
  } catch (error) {
    logger.error('Failed to get top performers', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve top performers'
    });
  }
});

/**
 * GET /revenue-analytics/trends
 * Get revenue trends (daily or hourly)
 */
router.get('/trends', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const period = req.query.period === 'hourly' ? 'hourly' : 'daily';
    
    const trends = await revenueAnalytics.getRevenueTrends(period, days);
    
    res.json({
      success: true,
      period_type: period,
      period_days: days,
      data_points: trends.length,
      trends
    });
  } catch (error) {
    logger.error('Failed to get trends', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trends'
    });
  }
});

/**
 * GET /revenue-analytics/summary
 * Get comprehensive summary (all data in one call)
 */
router.get('/summary', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    
    const [kpis, topPerformers, forecast] = await Promise.all([
      revenueAnalytics.getKPIs(days),
      revenueAnalytics.getTopPerformers(days, 5),
      revenueAnalytics.getForecast(7)
    ]);
    
    res.json({
      success: true,
      period_days: days,
      summary: {
        kpis,
        top_performers: topPerformers,
        forecast_7_days: forecast
      }
    });
  } catch (error) {
    logger.error('Failed to get summary', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve summary'
    });
  }
});

module.exports = router;
