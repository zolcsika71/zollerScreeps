"use strict";

let mod = {};
module.exports = mod;
mod.extend = () => {

    // structure constructors
    Room.Links = function (room) {
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
                        _.forEach(this.room.memory.links, add);
                    }
                    return this._all;
                }
            },
            'controller': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._controller)) {
                        let byType = c => c.controller === true;
                        this._controller = this.all.filter(byType);
                    }
                    return this._controller;
                }
            },
            'storage': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._storage)) {
                        let byType = l => l.storage == true;
                        this._storage = this.all.filter(byType);
                    }
                    return this._storage;
                }
            },
            'in': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._in)) {
                        let byType = l => l.storage == false && l.controller == false;
                        this._in = _.filter(this.all, byType);
                    }
                    return this._in;
                }
            },
            'privateers': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._privateers)) {
                        let byType = l => l.storage == false && l.controller == false && l.source == false && l.energy < l.energyCapacity * 0.85;
                        this._privateers = _.filter(this.all, byType);
                    }
                    return this._privateers;
                }
            }
        });
    };
    Room.Containers = function (room) {
        this.room = room;
        Object.defineProperties(this, {
            'all': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._container)) {
                        this._container = [];
                        let add = entry => {
                            let cont = Game.getObjectById(entry.id);
                            if (cont) {
                                _.assign(cont, entry);
                                this._container.push(cont);
                            }
                        };
                        _.forEach(this.room.memory.container, add);
                    }
                    return this._container;
                }
            },
            'controller': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._controller)) {
                        if (this.room.my && this.room.controller.memory.storage) {
                            this._controller = [Game.getObjectById(this.room.controller.memory.storage)];
                            if (!this._controller[0]) delete this.room.controller.memory.storage;
                        } else {
                            let byType = c => c.controller == true;
                            this._controller = _.filter(this.all, byType);
                        }
                    }
                    return this._controller;
                }
            },
            'in': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._in)) {
                        let byType = c => c.controller == false;
                        this._in = _.filter(this.all, byType);
                        // add managed
                        let isFull = c => c.sum >= (c.storeCapacity * (1 - MANAGED_CONTAINER_TRIGGER));
                        this._in = this._in.concat(this.managed.filter(isFull));
                    }
                    return this._in;
                }
            },
            'out': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._out)) {
                        let byType = c => c.controller == true;
                        this._out = _.filter(this.all, byType);
                        // add managed
                        let isEmpty = c => c.sum <= (c.storeCapacity * MANAGED_CONTAINER_TRIGGER);
                        this._out = this._out.concat(this.managed.filter(isEmpty));
                    }
                    return this._out;
                }
            },
            'privateers': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._privateers)) {
                        let byType = c => (c.source === false && !c.mineral && c.sum < c.storeCapacity);
                        this._privateers = _.filter(this.all, byType);
                    }
                    return this._privateers;
                }
            },
            'managed': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._managed)) {
                        let byType = c => c.source === true && c.controller == true;
                        this._managed = _.filter(this.all, byType);
                    }
                    return this._managed;
                }
            }
        });
    };
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
    Room.Nuker = function (room) {
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
                        _.forEach(this.room.memory.nukers, add);
                    }
                    return this._all;
                }
            }
        });
    };
    Room.PowerSpawn = function (room) {
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
                        _.forEach(this.room.memory.powerSpawns, add);
                    }
                    return this._all;
                }
            }
        });
    };

};

