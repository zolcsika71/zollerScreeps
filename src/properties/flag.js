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


};


