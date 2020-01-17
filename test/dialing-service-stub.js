'use strict';

const Bluebird = require('bluebird');

/**
 * Mocks dialing service interface. Implements `dial` method.
 */
class DialingServiceStub {
    /**
     * @param {*} ctx - An object with phone numbers as keys and result scenarios as values
     */
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * - Finds scenario corresponding to the phone number
     * - Waits for some time if specified in the scenario
     * - Eventually either returns a value or throws an exception, as configured in scenario
     * @param {*} agentId
     * @param {*} number
     */
    async dial(agentId, number) {
        const scenario = this.ctx[number];
        if (scenario) {
            if (scenario.waitMs !== undefined) {
                await Bluebird.delay(scenario.waitMs);
            }
            if (scenario.state !== undefined) {
                return scenario.state;
            } else if (scenario.exception !== undefined) {
                throw scenario.exception;
            }
            throw new Error('Invalid scenario. A scenario must specify either "state", or "exception" field');
        } else {
            throw new Error('Matching scenario was not found');
        }
    }
}

module.exports = DialingServiceStub;
