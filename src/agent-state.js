'use strict';

/**
 * States of a customer support agent
 */
const AgentState = {
    AVAILABLE: 'AgentState.AVAILABLE', // logged in
    WAITING: 'AgentState.WAITING', // waiting to be connected to a customer
    BUSY: 'AgentState.BUSY', // talking to a customer
    UNAVAILABLE: 'AgentState.UNAVAILABLE' // logged out

};

module.exports = AgentState;
