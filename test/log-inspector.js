'use strict';

const lodash = require('lodash');
const winston = require('winston');
require('../src/logger').getLogger(); // this initializes winston if it wasn't initailized elsewhere

let memoryTransport;

// Buffer to keep all logged messages
const allMessages = [];
// Buffer to keep logged messages grouped per logger
let messagesPerLogger = {};

/**
 * Test helper that sets up a memory transport to capture all logs during a given test
 */
class LogInspector {
    /**
     * Formatting function is used as an interceptor for all messages being logged
     * @param {*} options
     */
    static formatMessage(options) {
        const loggerName = lodash.defaultTo(options.meta.loggerName, '');
        const level = options.level.toUpperCase();
        const message = `[${level}] [${loggerName}] ${options.message}`;
        // keep a copy of the message in the global buffer
        allMessages.push(message);
        let buffer = messagesPerLogger[loggerName];
        if (buffer === undefined) {
            buffer = [];
            messagesPerLogger[loggerName] = buffer;
        }
        // keep a copy of the message in logger-specific buffer
        buffer.push(message);
        return message;
    }

    /**
     * Adds memory transport to loggers that were created before this class was required
     */
    static augmentExistingLogs() {
        for (const lgName in winston.loggers.loggers) {
            if (winston.loggers.loggers.hasOwnProperty(lgName)) {
                const logger = winston.loggers.loggers[lgName];
                if (!logger.transports.memory) {
                    logger.add(memoryTransport, null, true);
                } else if (logger.transports.memory !== memoryTransport) {
                    logger.remove(memoryTransport, null, true);
                    logger.add(memoryTransport, null, true);
                }
            }
        }
    }

    /**
     * Adds memory transport for loggers that will be created later
     */
    static addTransport() {
        let found = false;
        if (winston.loggers.options.transports === undefined) {
            winston.loggers.options.transports = [];
        }
        for (const t of winston.loggers.options.transports) {
            if (t.name === 'memory') {
                found = true;
            }
        }
        if (!found) {
            winston.loggers.options.transports.push(memoryTransport);
        }
    }

    /**
     * @returns {Array} log messages collected so far
     */
    static getLogs() {
        return allMessages;
    }

    /**
     * @returns {Array} log messages produced so far by the given logger
     */
    static getLogsFor(loggerName) {
        return messagesPerLogger[loggerName];
    }

    /**
     * Removes all buffered messages
     */
    static clearLogs() {
        // for memory transport we remove all contents of arrays without allocating new arrays
        // just in case other variables point to the same arrays
        memoryTransport.errorOutput.length = 0;
        memoryTransport.writeOutput.length = 0;
        // for our internal buffers we can simply allocate new buffers.
        allMessages.length = [];
        messagesPerLogger = {};
    }
}

/**
 * Sets up a global hook to clean buffered messages before each test
 */
beforeEach(() => {
    LogInspector.clearLogs();
});

/**
 * Sets up a global hook to print buffered messages to console when a test fails
 */
afterEach(function() {
    // eslint-disable-next-line no-invalid-this
    if (this.currentTest.state === 'failed') {
        const message = ['CAPTURED LOGS:', ...LogInspector.getLogs()].join('\n');
        // eslint-disable-next-line no-console
        console.error(message);
    }
});

/**
 * Memory transport buffers logged messages, but in this LogInspector class it is used only
 * as a hook to intercept messages. memoryTransport's buffers are not used, because messages
 * are split into two buckets, instead of being kept together in historical order.
 */
memoryTransport = new winston.transports.Memory({ level: 'debug', formatter: LogInspector.formatMessage });
// Setup memory transport for existing loggers
LogInspector.augmentExistingLogs();
// Setup memory transport for loggers to be created in the future
LogInspector.addTransport();

module.exports = LogInspector;
