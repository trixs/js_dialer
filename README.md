# Concurrent dialer

Test application demonstrating skills using promises.

## Build
- Install dependencies
```shell
$ npm install
```
- Run stylistic checks
```shell
$ npm eslint
```
- Run unit tests and generate coverage report 
```shell
$ npm test
```

## Design
Activities related to concurrent dialing are implemented in methods
``dialingWrapper`` and ``connect``. The former deals with dialing a single
phone number and processing the result, or handling an exception. The latter
starts multiple concurrent dial attempts, waits for the first successful
connection. In the case that all started dial attempts fail ``connect`` will
fetch new phone numbers from the database and create a new batch of 
concurrent attempts to dial new set of leads.

Unit tests are grouped into two suites: ``PowerDialer tests`` and ``PowerDialer concurrent tests``. The first tests that observer methods ``onAgentLogin``, ``onCallStarted`` and others perform proper state changes and prevent execution if called when agent is in the wrong state. The second test suite verifies proper logic while executing concurrent dialing.