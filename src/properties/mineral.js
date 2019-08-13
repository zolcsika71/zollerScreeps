"use strict";

let mod = {};
module.exports = mod;
mod.extend = function () {

    // extensions.js
    Object.defineProperty(Mineral.prototype, 'memory', {
        configurable: true,
        get: function () {
            if (_.isUndefined(Memory.minerals)) {
                Memory.minerals = {};
            }
            if (!_.isObject(Memory.minerals)) {
                return undefined;
            }
            return Memory.minerals[this.id] = Memory.minerals[this.id] || {};
        },
        set: function (value) {
            if (_.isUndefined(Memory.minerals)) {
                Memory.minerals = {};
            }
            if (!_.isObject(Memory.minerals)) {
                throw new Error('Could not set memory extension for minerals');
            }
            Memory.minerals[this.id] = value;
        }
    });
    Object.defineProperty(Mineral.prototype, 'container', {
        configurable: true,
        get: function () {
            let that = this;
            if (_.isUndefined(this.memory.container)) {
                this.room.saveContainers();
            }

            if (_.isUndefined(this._container)) {
                if (this.memory.terminal) {
                    this._container = Game.getObjectById(this.memory.terminal);
                    if (!this._container) delete this.memory.terminal;
                } else if (this.memory.storage) {
                    this._container = Game.getObjectById(this.memory.storage);
                    if (!this._container) delete this.memory.storage;
                } else if (this.memory.container) {
                    this._container = Game.getObjectById(this.memory.container);
                    if (!this._container) delete this.memory.container;
                } else this._container = null;
            }
            return this._container;
        }
    });

};

