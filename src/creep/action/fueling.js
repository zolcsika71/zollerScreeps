"use strict";


let action = new Creep.Action('fueling');
module.exports = action;
action.maxPerTarget = 1;
action.maxPerAction = 1;
action.isValidAction = function (creep) {
    return (creep.carry.energy > 0 && creep.room.towerFreeCapacity > 0);
};
action.isValidTarget = function (target) {
    return ((target) && (target.energy || target.energy == 0) && target.active && (target.energy < target.energyCapacity));
};
action.isAddableTarget = function (target) {
    return (target.my &&
        (!target.targetOf || target.targetOf.length < this.maxPerTarget));
};
action.newTarget = function (creep) {
    let fuelable = _.filter(creep.room.structures.fuelable, t =>
        Creep.action.fueling.isValidTarget(t) && Creep.action.fueling.isAddableTarget(t));
    if (fuelable.length) {
        const urgent = _.filter(fuelable, t => t.energy <= 100);
        if (urgent.length) {
            fuelable = urgent;
        }
        return creep.pos.findClosestByRange(fuelable);
    }
};
action.work = function (creep) {
    let response = creep.transfer(creep.target, RESOURCE_ENERGY);
    if (creep.target.energyCapacity - creep.target.energy < 20)
        creep.data.targetId = null;
    return response;
};
