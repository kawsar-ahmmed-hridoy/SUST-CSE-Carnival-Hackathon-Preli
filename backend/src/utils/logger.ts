import pino from 'pino';
import config from '@/config';

/**
 * Application-wide Pino logger.
 * - Development: pretty-printed, colorized output.
 * - Production: raw structured JSON for log aggregators (Datadog, CloudWatch, etc.).
 */
const logger = pino({
  level: config.logging.level,
  base: {
    service: 'queuestorm-investigator',
    env: config.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.pin',
      '*.otp',
      '*.token',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  ...(config.isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service,env',
          },
        },
      }),
});

export default logger;