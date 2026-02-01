// Set test environment variables before any test runs
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.INTERNAL_API_KEY = 'test-internal-api-key';
process.env.DB_SERVER = 'test-server';
process.env.DB_DATABASE = 'test-db';
process.env.DB_USER = 'test-user';
process.env.DB_PASSWORD = 'test-pass';
process.env.NODE_ENV = 'test';
