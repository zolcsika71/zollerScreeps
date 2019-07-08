"use strict";

let mod = {};
module.exports = mod;

mod.extend = function() {
    // Labs constructor
    Room.Labs = function (room) {
        this.room = room;
        Object.defineProperties(this, {
            'all': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._all)) {
                        this._all = [];
                        let add = entry => {
                            let o = Game.getObjectById(entry.id);
                            if (o) {
                                _.assign(o, entry);
                                this._all.push(o);
                            }
                        };
                        _.forEach(this.room.memory.labs, add);
                    }
                    return this._all;
                }
            },
            'storage': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._storage)) {
                        this._storage = _.filter(room.memory.resources.lab.reactionState, reactionState => {
                            return reactionState === 'Storage';
                        });
                    }
                    return this._storage;
                }
            }
        });
    };
};

