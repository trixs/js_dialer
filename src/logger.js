'use strict';

const winston = require('winston');

const LEVELS = Object.freeze({
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5
});

class Logger {
    static getLogger(name) {
        const logger = winston.loggers.get(name);
        logger.setLevels(LEVELS);
        logger.level = winston.level;
        return logger;
    }
}

module.exports = Logger;
