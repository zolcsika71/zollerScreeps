"use strict";

let mod = {};
module.exports = mod;
mod.extend = function () {

    Object.defineProperties(Creep.prototype, {
        'flee': {
            configurable: true,
            get: function () {
                if (!this.data) {
                    // err
                    return;
                }
                if (this.data.flee) {
                    // release when restored
                    this.data.flee = this.hits !== this.hitsMax;
                } else {
                    // set when low
                    this.data.flee = (this.hits / this.hitsMax) < 0.35;
                }
                return this.data.flee;
            },
            set: function (newValue) {
                this.data.flee = newValue;
            }
        },
        'sum': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._sum) || this._sumSet !== Game.time) {
                    this._sumSet = Game.time;
                    this._sum = _.sum(this.carry);
                }
                return this._sum;
            }
        },
        'threat': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._threat)) {
                    this._threat = Creep.bodyThreat(this.body);
                }
                return this._threat;
            }
        },
        'trace': { // only valid on one creep at a time
            configurable: true,
            get: function () {
                return Memory.debugTrace.creepName === this.name;
            },
            set: function (value) {
                if (value) {
                    Memory.debugTrace.creepName = this.name;
                } else if (this.trace) {
                    delete Memory.debugTrace.creepName;
                }
            }
        },
        'behaviour': {
            configurable: true,
            get: function () {
                return Creep.behaviour[this.data.creepType];
            }
        }
    });

};
