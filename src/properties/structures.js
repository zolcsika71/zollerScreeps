"use strict";

const
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./util.util`)
    };


let mod = {};
mod.extend = function () {

    // extensions.js
    Object.defineProperty(Structure.prototype, 'towers', {
        configurable: true,
        get: function () {
            if (_.isUndefined(this._towers) || this._towersSet !== Game.time) {
                this._towersSet = Game.time;
                this._towers = [];
            }
            return this._towers;
        },
        set: function (value) {
            this._towers = value;
        }
    });
    Object.defineProperty(Structure.prototype, 'active', {
        configurable: true,
        get() {
            if (!this.room.controller) {
                return _.get(this.room.memory, ['structures', this.id, 'active'], true);
            } else {
                if (!this.room.owner) return false;
                if (this.room.owner !== this.owner.username) return false;
                return _.get(this.room.memory, ['structures', this.id, 'active'], true);
            }
        }
    });
    Object.defineProperty(StructureTower.prototype, 'active', {
        configurable: true,
        get() {
            if (!this.room.owner) return false;
            if (this.room.owner !== this.owner.username) return false;
            if (this.room.RCL < 3) return false;
            return _.get(this.room.memory, ['structures', this.id, 'active'], true);
        }
    });
    Object.defineProperty(StructureLab.prototype, 'active', {
        configurable: true,
        get() {
            if (!this.room.owner) return false;
            if (this.room.owner !== this.owner.username) return false;
            if (this.room.RCL < 6) return false;
            return _.get(this.room.memory, ['structures', this.id, 'active'], true);
        }
    });
    Object.defineProperty(StructureWall.prototype, 'active', {
        configurable: true,
        get() {
            return this.room.RCL > 1;
        }
    });
    Object.defineProperty(StructureWall.prototype, 'isCriticallyFortifyable', {
        configurable: true,
        get() {
            return (this.hits <= MIN_FORTIFY_LIMIT[this.room.controller.level]);
        }
    });
    Object.defineProperty(StructureRampart.prototype, 'active', {
        configurable: true,
        get() {
            return this.room.RCL > 1;
        }
    });
    Object.defineProperty(StructureRampart.prototype, 'isCriticallyFortifyable', {
        configurable: true,
        get() {
            return (this.hits <= MIN_FORTIFY_LIMIT[this.room.controller.level]);
        }
    });
    Object.defineProperty(StructureContainer.prototype, 'active', {
        configurable: true,
        value: true
    });
    Object.defineProperty(StructureRoad.prototype, 'active', {
        configurable: true,
        value: true
    });
    Object.defineProperty(StructureController.prototype, 'memory', {
        configurable: true,
        get: function () {
            if (_.isUndefined(Memory.controllers)) {
                Memory.controllers = {};
            }
            if (!_.isObject(Memory.controllers)) {
                return undefined;
            }
            return Memory.controllers[this.id] = Memory.controllers[this.id] || {};
        },
        set: function (value) {
            if (_.isUndefined(Memory.controllers)) {
                Memory.controllers = {};
            }
            if (!_.isObject(Memory.controllers)) {
                throw new Error('Could not set memory extension for controller');
            }
            Memory.controllers[this.id] = value;
        }
    });
    Object.defineProperty(StructureStorage.prototype, 'sum', {
        configurable: true,
        get: function () {
            if (_.isUndefined(this._sum) || this._sumSet !== Game.time) {
                this._sumSet = Game.time;
                this._sum = _.sum(this.store);
            }
            return this._sum;
        }
    });
    Object.defineProperty(StructureStorage.prototype, 'charge', { // fraction indicating charge % relative to constants
        configurable: true,
        get: function () {
            // TODO per-room strategy
            return Util.chargeScale(this.store.energy,
                MIN_STORAGE_ENERGY[this.room.controller.level],
                MAX_STORAGE_ENERGY[this.room.controller.level]);
        }
    });
    Object.defineProperty(StructureTerminal.prototype, 'sum', {
        configurable: true,
        get: function () {
            if (_.isUndefined(this._sum) || this._sumSet !== Game.time) {
                this._sumSet = Game.time;
                this._sum = _.sum(this.store);
            }
            return this._sum;
        }
    });
    Object.defineProperty(StructureTerminal.prototype, 'charge', { // fraction indicating charge % relative to constants
        configurable: true,
        get: function () {
            const needs = this.getNeeds(RESOURCE_ENERGY);
            const terminalTarget = needs ? this.store[RESOURCE_ENERGY] + needs : TERMINAL_ENERGY;
            return GLOBAL.util.chargeScale(this.store.energy,
                terminalTarget,
                terminalTarget * 2);
        }
    });
    Object.defineProperty(StructureContainer.prototype, 'sum', {
        configurable: true,
        get: function () {
            if (_.isUndefined(this._sum) || this._sumSet !== Game.time) {
                this._sumSet = Game.time;
                this._sum = _.sum(this.store);
            }
            return this._sum;
        }
    });


};

module.exports = mod;
