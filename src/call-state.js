'use strict';
/**
 * Enumerated states of a phone connection
 */
const CallState = {
    CREATED: 'CallState.CREATED',
    ALERTING: 'CallState.ALERTING',
    CONNECTED: 'CallState.CONNECTED',
    DISCONNECTED: 'CallState.DISCONNECTED',
    FAILED: 'CallState.FAILED'
};

module.exports = CallState;
