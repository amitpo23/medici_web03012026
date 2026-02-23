/**
 * Workers Control API
 * Endpoints to manage background workers lifecycle and status.
 */

const express = require('express');
const router = express.Router();
const workerManager = require('../services/workers/worker-manager');

// GET /workers/status - All worker statuses
router.get('/status', (req, res) => {
  try {
    const status = workerManager.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /workers/names - List all worker names
router.get('/names', (req, res) => {
  try {
    const names = workerManager.getWorkerNames();
    res.json({ success: true, data: names });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /workers/start-all - Start all enabled workers
router.post('/start-all', (req, res) => {
  try {
    workerManager.startAll();
    res.json({ success: true, message: 'Start-all triggered (only enabled workers will start)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /workers/stop-all - Stop all workers
router.post('/stop-all', (req, res) => {
  try {
    workerManager.stopAll();
    res.json({ success: true, message: 'All workers stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /workers/:name/start - Start specific worker
router.post('/:name/start', (req, res) => {
  try {
    const { name } = req.params;
    const { interval } = req.body;
    workerManager.startWorker(name, interval);
    res.json({ success: true, message: `Worker '${name}' started` });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /workers/:name/stop - Stop specific worker
router.post('/:name/stop', (req, res) => {
  try {
    const { name } = req.params;
    workerManager.stopWorker(name);
    res.json({ success: true, message: `Worker '${name}' stopped` });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /workers/:name/status - Get specific worker status
router.get('/:name/status', (req, res) => {
  try {
    const status = workerManager.getStatus();
    const { name } = req.params;
    if (!status.workers[name]) {
      return res.status(404).json({ success: false, error: `Worker '${name}' not found` });
    }
    res.json({ success: true, data: status.workers[name] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
