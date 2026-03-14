// Jest setup file
import { Console } from 'console';

// Suppress console.log in tests unless VERBOSE is set
if (!process.env.VERBOSE) {
  global.console = new Console({
    stdout: process.stdout,
    stderr: process.stderr,
  });
}

// Set test timeout
jest.setTimeout(10000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kb_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Global beforeAll hook
beforeAll(async () => {
  // Add any global setup here
});

// Global afterAll hook
afterAll(async () => {
  // Add any global teardown here
});
