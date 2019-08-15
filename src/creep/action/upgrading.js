"use strict";

let action = new Creep.Action('upgrading');
module.exports = action;
action.targetRange = 3;
action.reachedRange = 3;
action.isAddableAction = creep => {
    // no storage
    return !creep.room.storage
        // storage has surplus
        || creep.room.storage.charge > 1
        // storage is leftover from invasion and has usable energy
        || (!creep.room.storage.my && creep.room.storage.store.energy > 0);
};
action.isAddableTarget = (target, creep) => {
    // Limit to upgraders only at RCL8
    return !(target.level === 8 && (!creep.data || creep.data.creepType !== 'upgrader'));
};
action.isValidAction = creep => creep.carry.energy > 0;
action.isValidTarget = target => target && target.structureType === 'controller' && target.my;
action.newTarget = function (creep) {
    const target = (creep.room.controller && creep.room.controller.my) ? creep.room.controller : null;
    return this.isValidTarget(target) && this.isAddableTarget(target, creep) && target;
};
action.work = (creep, range) => {
    if (range && range < 2) creep.controllerSign();
    return creep.upgradeController(creep.target);
};

