const express = require('express');
const router = express.Router();

// Get API version
router.get('/Version', (req, res) => {
  res.json({
    version: '1.0.0',
    apiName: 'Medici Hotels API',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
