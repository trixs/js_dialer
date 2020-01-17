'use strict';
/**
 * Mocks database interface. Implements `get_lead_phone_number_to_dial` method
 */
class DatabaseStub {
    /**
     * @param {*} A hashmap with phone numbers as keys
     */
    constructor(ctx) {
        this.numbers = Object.keys(ctx);
    }

    /**
     * Removes the first element from the array of numbers
     * and returns its value. When storage is empty returns undefined
     */
    getLeadPhoneNumberToDial() {
        if (this.numbers.length === 0) {
            return undefined;
        }
        const number = this.numbers.shift();
        return number;
    }
}

module.exports = DatabaseStub;
