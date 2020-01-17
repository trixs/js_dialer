'use strict';

const PowerDialer = require('../src/power-dialer');
const AgentState = require('../src/agent-state');
const CallState = require('../src/call-state');
const DatabaseStub = require('./database-stub');
const DialingServiceStub = require('./dialing-service-stub');
const LogInspector = require('./log-inspector');

const Bluebird = require('bluebird');
const expect = require('chai').expect;

/**
 * Tests for PowerDialer class
 */
describe('PowerDialer tests', () => {
    it('constructor', () => {
        const dialer = new PowerDialer(null, null, 'agent1');
        expect(dialer.agentId).equal('agent1');
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.UNAVAILABLE);
    });

    /**
     * Testing state change after a login
     */
    it('onAgentLogin; successful', () => {
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.AVAILABLE);
    });

    it('onAgentLogin; can\'t login twice', () => {
        /*
        Testing that attempt to login while being logged in
        should raise an exception and a log message
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        try {
            dialer.onAgentLogin();
            expect.fail('Undetected error');
        } catch (ex) {
            const msg = ex.message;
            expect(msg).contain('Agent "agent1" must be in UNAVAILABLE');
            expect(msg).contain('"AgentState.AVAILABLE"');
            const logs = LogInspector.getLogs();
            expect(logs).deep.equal(['[ERROR] [] Agent "agent1" must be in UNAVAILABLE state. Current state is "AgentState.AVAILABLE"']);
        }
    });

    it('onAgentLogin; after logout', () => {
        /*
        Testing that agent can login after logging out
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        dialer.onAgentLogout();
        dialer.onAgentLogin();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.AVAILABLE);
    });

    it('onAgentLogout', () => {
        /*
        Testing status change after logout
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        dialer.onAgentLogout();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.UNAVAILABLE);
    });

    it('onAgentLogout; twice', () => {
        /*
        Testing that logging out after a logout doesn't cause exceptions
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        dialer.onAgentLogout();
        dialer.onAgentLogout();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.UNAVAILABLE);
    });

    it('onAgentLogout; during a call that ends successfully', async() => {
        /*
        Testing that an agent can indicate desire to logout during a call
        He will be logged out after the call ends
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        dialer.onAgentLogout();
        expect(dialer.isLoggingOut).equal(true);
        expect(dialer.currentLead).equal('+12123334444');
        expect(dialer.agentState).equal(AgentState.BUSY);
        dialer.onCallEnded();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.UNAVAILABLE);
    });

    it('onAgentLogout; during a call that eventually fails', async() => {
        /*
        Testing that an agent can indicate desire to logout during a call
        He will be logged out after the call fails
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        dialer.onAgentLogout();
        expect(dialer.isLoggingOut).equal(true);
        expect(dialer.currentLead).equal('+12123334444');
        expect(dialer.agentState).equal(AgentState.BUSY);
        dialer.onCallFailed();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.UNAVAILABLE);
    });

    it('onCallStarted; without connect', () => {
        /*
        Test that attempt to call onCallStarted when agent is not in WAITING state
        should raise an exception and log an error message
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        try {
            dialer.onCallStarted('+12123334444');
            expect.fail('Undetected error');
        } catch (ex) {
            const msg = ex.message;
            expect(msg).contains('Agent "agent1" must be in WAITING');
            expect(msg).contains('"AgentState.AVAILABLE"');
        }
        const logs = LogInspector.getLogs();
        expect(logs).deep.equal(['[ERROR] [] Agent "agent1" must be in WAITING state. Current state is "AgentState.AVAILABLE"']);
    });

    it('onCallFailed', async() => {
        /*
        Test status change when call terminates unexpectedly
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        dialer.onCallFailed();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.AVAILABLE);
        const logs = LogInspector.getLogs();
        expect(logs).deep.equal(['[WARN] [] Call failed for agent="agent1" lead="+12123334444"']);
    });

    it('onCallFailed; without connect', () => {
        /*
        Test that attempt to call onCallFailed when agent is not on the call
        should raise an exception and log an error message
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        try {
            dialer.onCallFailed();
            expect.fail('Undetected error');
        } catch (ex) {
            const msg = ex.message;
            expect(msg).contains('Agent "agent1" must be in BUSY');
            expect(msg).contains('"AgentState.AVAILABLE"');
        }
        const logs = LogInspector.getLogs();
        expect(logs).deep.equal(['[ERROR] [] Agent "agent1" must be in BUSY state. Current state is "AgentState.AVAILABLE"']);
    });

    it('onCallEnded', async() => {
        /*
        Test status change when call terminates correctly
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        dialer.onCallEnded();
        expect(dialer.isLoggingOut).equal(false);
        expect(dialer.currentLead).equal('');
        expect(dialer.agentState).equal(AgentState.AVAILABLE);
    });

    it('onCallFailed; without connect', () => {
        /*
        Test that attempt to call onCallEnded when agent is not on the call
        should raise an exception and log an error message
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        try {
            dialer.onCallEnded();
            expect.fail('Undetected error');
        } catch (ex) {
            const msg = ex.message;
            expect(msg).contains('Agent "agent1" must be in BUSY');
            expect(msg).contains('"AgentState.AVAILABLE"');
        }
        const logs = LogInspector.getLogs();
        expect(logs).deep.equal(['[ERROR] [] Agent "agent1" must be in BUSY state. Current state is "AgentState.AVAILABLE"']);
    });

    it('conect; without login', async() => {
        /*
        Testing that attempt to connect without a login
        results in an exception and a log message
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        try {
            await dialer.connect();
            expect.fail('Undetected error');
        } catch (ex) {
            const msg = ex.message;
            expect(msg).contains('Agent "agent1" must be in AVAILABLE');
            expect(msg).contains('"AgentState.UNAVAILABLE"');
        }
        const logs = LogInspector.getLogs();
        expect(logs).deep.equal(['[ERROR] [] Agent "agent1" must be in AVAILABLE state. Current state is "AgentState.UNAVAILABLE"']);
    });

    it('conect', async() => {
        /*
        Testing status change after successful connection
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        expect(dialer.currentLead).equal('+12123334444');
        expect(dialer.agentState).equal(AgentState.BUSY);
    });
});

describe('PowerDialer concurrent tests', () => {
    async function validate(dialer, cb) {
        // validate assertions immediately after the first connect
        cb();
        try {
            await Bluebird.all(dialer.promises);
        } catch (ex) {
            // ignore if some dialing attempts failed
        }
        // validate assertions again after all promises get resolved
        cb();
    }

    it('conect; without leads', async() => {
        /*
        Testing that if database has no leads, then agent's status doesn't change
        */
        const ctx = {
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        await validate(dialer, () => {
            expect(dialer.agentState).equal(AgentState.AVAILABLE);
            expect(dialer.currentLead).equal('');
        });
    });

    it('conect; two leads successful', async() => {
        /*
        Testing that when dialing 2 numbers. We will use the one we connected to sooner
        */
        const ctx = {
            '+12123334444': { state: CallState.CONNECTED, waitMs: 5 },
            '+12123334449': { state: CallState.CONNECTED, waitMs: 10 }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        await validate(dialer, () => {
            expect(dialer.agentState).equal(AgentState.BUSY);
            expect(dialer.currentLead).equal('+12123334444');
        });
    });

    it('conect; two leads; one lead fails', async() => {
        /*
        Testing that when dialing 2 numbers. One connection fails, one succeeds.
        Status should reflect proper connection
        */
        const ctx = {
            '+12123334444': { state: CallState.DISCONNECTED, waitMs: 5 },
            '+12123334449': { state: CallState.CONNECTED, waitMs: 10 }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        await validate(dialer, () => {
            expect(dialer.agentState).equal(AgentState.BUSY);
            expect(dialer.currentLead).equal('+12123334449');
        });
    });

    it('conect; two leads; one lead throws', async() => {
        /*
        Testing that when dialing 2 numbers. One connection connects, the other throws an exception
        Status should reflect proper connection
        */
        const ctx = {
            '+12123334444': { exception: new Error('Dialing service failed'), waitMs: 5 },
            '+12123334449': { state: CallState.CONNECTED, waitMs: 10 }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        await validate(dialer, () => {
            expect(dialer.agentState).equal(AgentState.BUSY);
            expect(dialer.currentLead).equal('+12123334449');
            const logs = LogInspector.getLogs();
            expect(logs).deep.equal(['[ERROR] [] Dialing "+12123334444" for agent "agent1" failed. Error: "Dialing service failed"']);
        });
    });

    it('conect; two leads fail; should try the third', async() => {
        /*
        Testing that when dialing 2 numbers. Both attempts fail
        The code should fetch yet another number or two from the database
        */
        const ctx = {
            '+12123334444': { exception: new Error('Dialing service failed'), waitMs: 5 },
            '+12123334449': { state: CallState.FAILED, waitMs: 10 },
            '+12123334447': { state: CallState.CONNECTED, waitMs: 5 }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        await validate(dialer, () => {
            expect(dialer.agentState).equal(AgentState.BUSY);
            expect(dialer.currentLead).equal('+12123334447');
            const logs = LogInspector.getLogs();
            expect(logs).deep.equal([
                '[ERROR] [] Dialing "+12123334444" for agent "agent1" failed. Error: "Dialing service failed"',
                '[WARN] [] Failed dialing "+12123334449" for agent "agent1" failed. Call ended in state: "CallState.FAILED"'
            ]);
        });
    });

    it('conect; all leads fail', async() => {
        /*
        Testing that when dialing 2 numbers. Both attempts fail
        The code should fetch yet another number or two from the database
        */
        const ctx = {
            '+12123334444': { exception: new Error('Dialing service failed'), waitMs: 5 },
            '+12123334449': { state: CallState.FAILED, waitMs: 10 },
            '+12123334447': { state: CallState.DISCONNECTED, waitMs: 5 }
        };
        const dialer = new PowerDialer(new DatabaseStub(ctx), new DialingServiceStub(ctx), 'agent1');
        dialer.onAgentLogin();
        await dialer.connect();
        await validate(dialer, () => {
            expect(dialer.agentState).equal(AgentState.AVAILABLE);
            expect(dialer.currentLead).equal('');
            const logs = LogInspector.getLogs();
            expect(logs).deep.equal([
                '[ERROR] [] Dialing "+12123334444" for agent "agent1" failed. Error: "Dialing service failed"',
                '[WARN] [] Failed dialing "+12123334449" for agent "agent1" failed. Call ended in state: "CallState.FAILED"',
                '[WARN] [] Failed dialing "+12123334447" for agent "agent1" failed. Call ended in state: "CallState.DISCONNECTED"'
            ]);
        });
    });

});
