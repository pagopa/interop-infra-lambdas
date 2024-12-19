const LOG_LEVELS = ["debug", "info", "warn", "error"]

//TODO Winston

class CustomLogger {
    
    constructor(logLevel = "info") {
        this.logLevel = logLevel;
    }

    log(level, message, meta = null) {
        if (Object.values(LOG_LEVELS).indexOf(level) >= Object.values(LOG_LEVELS).indexOf(this.logLevel)) {
            console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`, meta ? meta : '');
        }
    }

    info(message, meta = null) {
        this.log("info", message, meta);
    }

    debug(message, meta = null) {
        this.log("debug", message, meta);
    }

    warn(message, meta = null) {
        this.log("warn", message, meta);
    }

    error(message, meta = null) {
        this.log("error", message, meta);
    }
}

module.exports = CustomLogger