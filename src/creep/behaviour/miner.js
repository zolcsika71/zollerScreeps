"use strict";

let behaviour = new Creep.Behaviour('miner');

module.exports = behaviour;
behaviour.actions = function(creep) {
    return [
        Creep.action.mining,
        Creep.action.recycling,
    ];
};

