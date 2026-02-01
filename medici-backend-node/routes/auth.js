const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/database');
const logger = require('../config/logger');

// Sign-in endpoint
router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('email', email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    
    // Compare password (assuming hashed in DB)
    const validPassword = await bcrypt.compare(password, user.Password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.Id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email
      },
      authorization: `Bearer ${token}`
    });

  } catch (err) {
    logger.error('Sign-in error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
