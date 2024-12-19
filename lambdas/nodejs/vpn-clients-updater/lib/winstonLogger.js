const winston = require("winston");

const logLevel = process.env.LOG_LEVEL || "info";

const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Timestamp for logs
        winston.format.errors({ stack: true }), // Include stack trace for errors
        winston.format.json() // Log in JSON format for structured logging
    ),
    transports: [
        new winston.transports.Console()
    ],
});

module.exports = logger;