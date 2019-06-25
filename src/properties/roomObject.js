"use strict";

let mod = {};
module.exports = mod;
mod.extend = function(){

    // extensions.js
    Object.defineProperty(RoomObject.prototype, 'accessibleFields', {
        configurable: true,
        get: function() {
            if ( this.memory && !_.isUndefined(this.memory.accessibleFields) ) {
                return this.memory.accessibleFields;
            } else {
                var fields = this.room.lookForAtArea(LOOK_TERRAIN, this.pos.y-1, this.pos.x-1, this.pos.y+1, this.pos.x+1, true);
                let walls = _.countBy( fields , "terrain" ).wall;
                var accessibleFields = walls === undefined ? 9 : 9-walls;
                return (this.memory) ? this.memory.accessibleFields = accessibleFields : accessibleFields;
            }
        }
    });

    Object.defineProperty(RoomObject.prototype, 'cloak', {
        configurable: true,
        get: function() {
            const value = Memory.cloaked[this.id];
            if (!value) {
                return false;
            } else if (_.isNumber(value) && Game.time > value) {
                delete Memory.cloaked[this.id];
                return false;
            } else {
                return value;
            }
        },
        set: function(value) {
            if (!value) {
                delete Memory.cloaked[this.id];
                return undefined;
            } else if (_.isNumber(value)) {
                if (value < Game.time) {
                    value = Game.time + value;
                }
            } else {
                value = true;
            }
            return Memory.cloaked[this.id] = value;
        }
    });

};
