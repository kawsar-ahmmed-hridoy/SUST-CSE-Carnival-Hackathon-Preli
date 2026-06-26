/**
 * Jest setup file. Loaded before each test file.
 */

// Silence Pino during tests — keeps output clean.
process.env.LOG_LEVEL = 'silent';