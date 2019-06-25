"use strict";

let mod = {};
module.exports = mod;
mod.extend = function () {

    Object.defineProperty(Flag.prototype, 'cloaking', {
        configurable: true,
        get: function () {
            return this.memory.cloaking || '0';
        },
        set: function (value) {
            this.memory.cloaking = value;
        }
    });

    Object.defineProperty(Flag, 'compare', {
        configurable: true,
        value: function (flagA, flagB) {
            return flagA.color === flagB.color && flagA.secondaryColor === flagB.secondaryColor;
        }
    });

    Object.defineProperty(Flag.prototype, 'compareTo', {
        configurable: true,
        // FLAG_COLOR flag
        value: function (flag) {
            return Flag.compare(this, flag);
        }
    });

    Object.defineProperty(RoomPosition.prototype, 'newFlag', {
        configurable: true,
        /**
         * Create a new flag at this position
         * @param {Object|string} flagColour - An object with color and secondaryColor properties, or a string path for a FLAG_COLOR
         * @param {string} [name] - Optional name for the flag
         * @returns {string|Number} The name of the flag or an error code.
         */
        value: function (flagColour, name) {
            if (!flagColour) flagColour = _.get(FLAG_COLOR, flagColour); // allows you to pass through a string (e.g. 'invade.robbing')
            if (!flagColour) return;
            return this.createFlag(name, flagColour.color, flagColour.secondaryColor);
        }
    });

    Object.defineProperty(Room.prototype, 'newFlag', {
        configurable: true,
        /**
         * Create a new flag
         * @param {Object|string} flagColour - An object with color and secondaryColor properties, or a string path for a FLAG_COLOR
         * @param {RoomPosition} [pos] - The position to place the flag. Will assume (25, 25) if left undefined
         * @param {string} [name] - Optional name for the flag
         * @returns {string|Number} The name of the flag or an error code.
         */
        value: function (flagColour, pos, name) {
            if (!pos) pos = this.getPositionAt(25, 25);
            return pos.newFlag(flagColour, name);
        }
    });

};


