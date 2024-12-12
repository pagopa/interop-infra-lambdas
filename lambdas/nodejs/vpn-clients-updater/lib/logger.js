const LOG_LEVELS = ["debug", "info", "warn", "error"]

class CustomLogger {
    
    constructor(logLevel = "info") {
        this.logLevel = logLevel;
    }

    log(level, message, meta = {}) {
        if (Object.values(LOG_LEVELS).indexOf(level) >= Object.values(LOG_LEVELS).indexOf(this.logLevel)) {
            console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`, meta);
        }
    }

    info(message, meta = {}) {
        this.log("info", message, meta);
    }

    debug(message, meta = {}) {
        this.log("debug", message, meta);
    }

    warn(message, meta = {}) {
        this.log("warn", message, meta);
    }

    error(message, meta = {}) {
        this.log("error", message, meta);
    }
}

module.exports = CustomLogger