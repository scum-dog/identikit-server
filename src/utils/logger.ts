import winston from "winston";

export interface LogMetadata {
  userId?: string;
  requestId?: string;
  duration?: number;
  errorCode?: string;
  [key: string]: unknown;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      let logMessage = `${timestamp} [${level}]: ${message}`;

      if (stack) {
        logMessage += `\n${stack}`;
      }

      if (Object.keys(meta).length > 0) {
        logMessage += `\n${JSON.stringify(meta, null, 2)}`;
      }

      return logMessage;
    }),
  ),
  transports: [new winston.transports.Console()],
});

class Logger {
  error(message: string, meta?: LogMetadata): void {
    logger.error(message, meta);
  }

  warn(message: string, meta?: LogMetadata): void {
    logger.warn(message, meta);
  }

  info(message: string, meta?: LogMetadata): void {
    logger.info(message, meta);
  }

  debug(message: string, meta?: LogMetadata): void {
    logger.debug(message, meta);
  }

  withRequestContext(requestId: string, userId?: string) {
    const contextMeta = { requestId, userId };
    return {
      error: (message: string, meta?: LogMetadata) =>
        this.error(message, { ...meta, ...contextMeta }),
      warn: (message: string, meta?: LogMetadata) =>
        this.warn(message, { ...meta, ...contextMeta }),
      info: (message: string, meta?: LogMetadata) =>
        this.info(message, { ...meta, ...contextMeta }),
      debug: (message: string, meta?: LogMetadata) =>
        this.debug(message, { ...meta, ...contextMeta }),
    };
  }
}

export const log = new Logger();
export default logger;
