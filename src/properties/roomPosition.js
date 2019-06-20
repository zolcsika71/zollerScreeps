"use strict";

let mod = {};
mod.extend = function(){

    // extensions.js
    Object.defineProperty(RoomPosition.prototype, 'adjacent', {
        configurable: true,
        get: function() {
            if( _.isUndefined(this._adjacent) )  {
                this._adjacent = [];
                for(let x = this.x-1; x < this.x+2; x++){
                    for(let y = this.y-1; y < this.y+2; y++){
                        if( x > 0 && x < 49 && y > 0 && y < 49 ){
                            this._adjacent.push(new RoomPosition(x, y, this.roomName));
                        }
                    }
                }
            }
            return this._adjacent;
        }
    });
    Object.defineProperty(RoomPosition.prototype, 'radius', {
        configurable: true,
        value: function(radius = 1) {
            if (radius === 1) return this.adjacent;
            if (radius < 1) return [this];
            const positions = [];
            for (let x = this.x - radius; x <= this.x + radius; x++) {
                for (let y = this.y - radius; y <= this.y + radius; y++) {
                    const pos = new RoomPosition(x, y, this.roomName);
                    if (50 > x && x > 0 && 0 < y && y < 50 && !_.isEqual(this, pos)) {
                        positions.push(pos);
                    }
                }
            }
            return positions;
        },
    });

};
module.exports = mod;