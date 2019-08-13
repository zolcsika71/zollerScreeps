"use strict";

let behaviour = new Creep.Behaviour('hauler');

module.exports = behaviour;

behaviour.inflowActions = (creep) => {
    return [
        Creep.action.uncharging,
        Creep.action.picking,
        Creep.action.withdrawing,
        Creep.action.reallocating
    ];
};
behaviour.outflowActions = (creep) => {
    let priority = [
        Creep.action.feeding,
        Creep.action.charging,
        Creep.action.fueling,
        Creep.action.storing
    ];
    if (creep.sum > creep.carry.energy ||
        (!creep.room.situation.invasion &&
            global.SPAWN_DEFENSE_ON_ATTACK && creep.room.conserveForDefense && creep.room.relativeEnergyAvailable > 0.8)) {
        priority.unshift(Creep.action.storing);
    }
    if (creep.room.structures.urgentRepairable.length > 0) {
        priority.unshift(Creep.action.fueling);
    }
    return priority;
};
behaviour.nextAction = function(creep) {
    if(creep.pos.roomName !== creep.data.homeRoom && Game.rooms[creep.data.homeRoom] && Game.rooms[creep.data.homeRoom].controller ) {
        return Creep.action.travelling.assignRoom(creep, creep.data.homeRoom);
    }
    return this.nextEnergyAction(creep);
};
behaviour.strategies.picking = {
    name: `picking-${behaviour.name}`,
    energyOnly: false
};