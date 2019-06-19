"use strict";

let mod = {};
mod.extend = function(){

    // extensions.js
    Object.defineProperty(Source.prototype, 'memory', {
        configurable: true,
        get: function() {
            if(_.isUndefined(Memory.sources)) {
                Memory.sources = {};
            }
            if(!_.isObject(Memory.sources)) {
                return undefined;
            }
            return Memory.sources[this.id] = Memory.sources[this.id] || {};
        },
        set: function(value) {
            if(_.isUndefined(Memory.sources)) {
                Memory.sources = {};
            }
            if(!_.isObject(Memory.sources)) {
                throw new Error('Could not set memory extension for sources');
            }
            Memory.sources[this.id] = value;
        }
    });
    Object.defineProperty(Source.prototype, 'container', {
        configurable: true,
        get: function() {
            let that = this;
            if( _.isUndefined(this.memory.container)) {
                this.room.saveContainers();
            };

            if( _.isUndefined(this._container) ) {
                if( this.memory.storage ) {
                    this._container = Game.getObjectById(this.memory.storage);
                    if( !this._container ) delete this.memory.storage;
                }
                else if( this.memory.terminal ) {
                    this._container = Game.getObjectById(this.memory.terminal);
                    if( !this._container ) delete this.memory.terminal;
                }
                else if( this.memory.container ) {
                    this._container = Game.getObjectById(this.memory.container);
                    if( !this._container ) delete this.memory.container;
                } else this._container = null;
            }
            return this._container;
        }
    });
    Object.defineProperty(Source.prototype, 'link', {
        configurable: true,
        get: function() {
            if( _.isUndefined(this._link) ) {
                if( this.memory.link ) {
                    this._link = Game.getObjectById(this.memory.link);
                    if( !this._link ) delete this.memory.link;
                } else this._link = null;
            }
            return this._link;
        }
    });

};
module.exports = mod;