"use strict";

let behaviour = new Creep.Behaviour('miner');

module.exports = behaviour;
behaviour.actions = function (creep) {
    return [
        Creep.action.mining,
        Creep.action.recycling
    ];
};

behaviour.run = function (creep) {
    Creep.behaviour.ranger.heal.call(this, creep);
    // original -> return this.baseOf.internalViral.run.call(this, creep);
    // own -> return this.baseOf.run.call(this, creep);
};


