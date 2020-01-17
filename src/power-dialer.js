'use strict';

const AgentState = require('./agent-state');
const CallState = require('./call-state');
const Logger = require('./logger');

const BlueBird = require('bluebird');

const logger = Logger.getLogger('PowerDialer');

/**
 * This solution uses a slightly diferent interface from the one proposed in the design.
 * Instead of using functions `dial` and `get_lead_phone_number_to_dial`
 * this implementation expects two objects to be injected:
 *
 * - dialing_service which implements method `dial`
 * - database which implements method `get_lead_phone_number_to_dial`
 *
 * this way tests may inject stubs that implement desired behavior.
 */
class PowerDialer {
    /**
     * Constructor

     * :param agent_id: The name to use.
     * :param database: an object implementing `get_lead_phone_number_to_dial` method
     * :param dialing_service: an object implementing `dial` method
    */
    constructor(database, dialingService, agentId) {
        this.DIAL_RATIO = 2;
        this.database = database;
        this.dialingService = dialingService;
        this.agentId = agentId;
        this.agentState = AgentState.UNAVAILABLE;
        this.currentLead = ''; // phone number of the current customer
        this.isLoggingOut = false; // changed if agent indicates desire to logout during a call
        this.promises = []; // array of promises started in connect method. It's used in unit tests
    }

    /**
     * Notification when agent logs in and can be connected with customers
     */
    onAgentLogin() {
        if (this.agentState !== AgentState.UNAVAILABLE) {
            const msg = `Agent "${this.agentId}" must be in UNAVAILABLE state. `
                + `Current state is "${this.agentState}"`;
            logger.error(msg);
            throw new Error(msg);
        }
        this.agentState = AgentState.AVAILABLE;
    }

    /**
     * Notification when agent logs out and should not be connected with customers anymore
     */
    onAgentLogout() {
        if (this.agentState === AgentState.AVAILABLE) {
            // if agent is not connected to a customer he can logout immediately
            this.agentState = AgentState.UNAVAILABLE;
        } else if ([AgentState.BUSY, AgentState.WAITING].includes(this.agentState)) {
            // a busy, or connecting agent will be logged out later
            // after the end of the current call
            this.isLoggingOut = true;
        }
        // an attempt to logout again is treated as a no-op
    }

    /**
     * Notification when agent is connected with a customer
     * @param {*} leadPhoneNumber
     */
    onCallStarted(leadPhoneNumber) {
        if (this.agentState !== AgentState.WAITING) {
            const msg = (`Agent "${this.agentId}" must be in WAITING state. `
                   + `Current state is "${this.agentState}"`);
            logger.error(msg);
            throw new Error(msg);
        }
        this.agentState = AgentState.BUSY;
        this.currentLead = leadPhoneNumber;
    }

    /**
     * Notification when call unexpectedly ends. And the agent can be connected again
     */
    onCallFailed() {
        if (this.agentState !== AgentState.BUSY) {
            const msg = `Agent "${this.agentId}" must be in BUSY state. `
                   + `Current state is "${this.agentState}"`;
            logger.error(msg);
            throw new Error(msg);
        }
        const warnMsg = `Call failed for agent="${this.agentId}" lead="${this.currentLead}"`;
        logger.warn(warnMsg);
        this.currentLead = '';
        if (this.isLoggingOut) {
            // agent wants to logout after the current call
            this.isLoggingOut = false;
            this.agentState = AgentState.UNAVAILABLE;
        } else {
            this.agentState = AgentState.AVAILABLE;
        }
    }

    /**
     * Notification when call ends. And the agent can be connected again
     */
    onCallEnded() {
        if (this.agentState !== AgentState.BUSY) {
            const msg = `Agent "${this.agentId}" must be in BUSY state. `
                   + `Current state is "${this.agentState}"`;
            logger.error(msg);
            throw new Error(msg);
        }
        this.currentLead = '';
        if (this.isLoggingOut) {
            // agent wants to logout after the current call
            this.isLoggingOut = false;
            this.agentState = AgentState.UNAVAILABLE;
        } else {
            this.agentState = AgentState.AVAILABLE;
        }
    }

    /**
     * Handles dialing of a single phone number. If this attempt is successful sets an event
     * If this is the last thread to finish then also sets the event
     * @param {*} phoneNumber
     */
    async dialingWrapper(phoneNumber) {
        let connState;
        try {
            connState = await this.dialingService.dial(this.agentId, phoneNumber);
        } catch (ex) {
            const msg = `Dialing "${phoneNumber}" for agent "${this.agentId}" failed. Error: "${ex.message}"`;
            logger.error(msg);
            throw new Error(msg);
        }
        if (connState === CallState.CONNECTED) {
            return phoneNumber;
        }
        const msg = `Failed dialing "${phoneNumber}" for agent "${this.agentId}" failed. Call ended in state: "${connState}"`;
        logger.warn(msg);
        throw new Error(msg);

    }

    /**
     * Connects agent with the next customer
     */
    async connect() {
        // First let's ensure that agent is available
        if (this.agentState !== AgentState.AVAILABLE) {
            const msg = `Agent "${this.agentId}" must be in AVAILABLE state. `
                   + `Current state is "${this.agentState}"`;
            logger.error(msg);
            throw new Error(msg);
        }
        // remove all contents from promises array
        this.promises.length = 0;
        // We start multiple concurrent attempts, but there is a small chance
        // that all attempts will fail. Then we will start a new batch
        let shouldRetry = true;
        while (shouldRetry) {
            // Fetch phone numbers from the database. We would like to get up to DIAL_RATIO
            // number of leads, but we need to take care of exceptional cases when database
            // doesn't have not enough leads
            const leads = [];
            for (let i = 0; i < this.DIAL_RATIO; ++i) {
                const lead = this.database.getLeadPhoneNumberToDial();
                if (lead !== undefined) {
                    leads.push(lead);
                } else {
                    break;
                }
            }

            // if we found some leads let's dial them
            if (leads.length > 0) {
                this.agentState = AgentState.WAITING;
                // dial all leads concurrently
                for (let lead of leads) {
                    let promise = this.dialingWrapper(lead);
                    this.promises.push(promise);
                }
                // wait for the first request to complete
                let connectedNumber;
                try {
                    connectedNumber = await BlueBird.any(this.promises);
                } catch (ex) {
                    // ignore exceptions here. They are logged by dialing service
                }
                if (connectedNumber) {
                    this.onCallStarted(connectedNumber);
                    shouldRetry = false;
                }
                // in a proper application one would use the remaining connected calls
                // to be connnected with other agents in the pool
            } else {
                // no more leads in the database
                this.agentState = AgentState.AVAILABLE;
                shouldRetry = false;
            }
        }
    }
}

module.exports = PowerDialer;
