"use strict";


let action = new Creep.Action('fortifying');
module.exports = action;
action.maxPerTarget = 1;
action.maxPerAction = 3;
action.targetRange = 3;
action.isValidAction = function (creep) {
    return creep.carry.energy > 0 && ((!creep.room.storage || !creep.room.storage.active) || creep.room.storage.charge > 0.6 || creep.room.nuked);
};
action.isValidTarget = function (target) {
    return (target && target.active && target.hits && target.hits < target.hitsMax);
};
action.newTarget = function (creep) {
    let that = this,
        isAddable = target => that.isAddableTarget(target, creep);

    return _.find(creep.room.structures.fortifyable, isAddable);
};
action.work = function (creep) {
    return creep.repair(creep.target);
};