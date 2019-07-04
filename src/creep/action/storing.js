"use strict";

let action = new Creep.Action('storing');
module.exports = action;
action.isValidAction = function (creep) {
    return creep.room.storage && creep.room.storage.isActive() && creep.sum > 0;
};
action.isValidTarget = function (target) {
    return ((target) && (target.store) && target.active && target.sum < target.storeCapacity);
};
action.isAddableTarget = function (target, creep) {
    return (target.my &&
        (!target.targetOf || target.targetOf.length < this.maxPerTarget) &&
        target.sum + creep.carry[RESOURCE_ENERGY] < target.storeCapacity);
};
action.isValidMineralToTerminal = function (room, mineral) {

    if (mineral === RESOURCE_ENERGY)
        return false;

    let mineralIsCompound = mineral.length > 1 || mineral === RESOURCE_GHODIUM;

    if (!mineralIsCompound) {

        if (mineral === room.mineralType)
            return room.storage.store[mineral]
                && (room.storage.sum >= room.storage.storeCapacity * 0.9 || room.storage.store[mineral] > global.MAX_STORAGE_MINERAL)
                && room.terminal.sum - room.terminal.store.energy < global.MAX_STORAGE_TERMINAL
                && room.terminal.sum - room.terminal.store.energy + Math.max(room.terminal.store.energy, global.TERMINAL_ENERGY) < room.terminal.storeCapacity;
        else
            return room.storage.store[mineral] &&
                (room.storage.sum >= room.storage.storeCapacity * 0.9 || room.storage.store[mineral] > global.MAX_STORAGE_NOT_ROOM_MINERAL)
                && room.terminal.sum - room.terminal.store.energy < global.MAX_STORAGE_TERMINAL
                && room.terminal.sum - room.terminal.store.energy + Math.max(room.terminal.store.energy, global.TERMINAL_ENERGY) < room.terminal.storeCapacity;

    } else if (global.SELL_COMPOUND[mineral] && global.SELL_COMPOUND[mineral].sell)
        return room.storage.store[mineral]
            && room.storage.store[mineral] > global.SELL_COMPOUND[mineral].maxStorage
            && room.terminal.sum - room.terminal.store.energy < global.MAX_STORAGE_TERMINAL
            && room.terminal.sum - room.terminal.store.energy + Math.max(room.terminal.store.energy, global.TERMINAL_ENERGY) < room.terminal.storeCapacity;
    else
        return false;

};
action.newTarget = function (creep) {


    let isValidMineralToTerminal,
        sendMineralToTerminal = function (creep) {

            for (const mineral in creep.room.storage.store) {

                isValidMineralToTerminal = action.isValidMineralToTerminal(creep.room, mineral);

                if (creep.carry[mineral] && creep.carry[mineral] > 0 && isValidMineralToTerminal)
                    return true;
            }

            return false;

        };

    let sendEnergyToTerminal = creep => (
        creep.carry.energy > 0 &&
        creep.room.storage.charge > 0.5 &&
        creep.room.terminal.store.energy < TERMINAL_ENERGY * 0.95 &&
        creep.room.terminal.sum  < creep.room.terminal.storeCapacity);



    if (creep.room.terminal && creep.room.terminal.active &&
        (sendMineralToTerminal(creep) || sendEnergyToTerminal(creep)) &&
        this.isAddableTarget(creep.room.terminal, creep)) {
        return creep.room.terminal;
    }

    if (this.isValidTarget(creep.room.storage) && this.isAddableTarget(creep.room.storage, creep))
        return creep.room.storage;

    return null;
};
action.work = function (creep) {
    let workResult;
    for (let resourceType in creep.carry) {
        if (creep.carry[resourceType] > 0) {
            workResult = creep.transfer(creep.target, resourceType);
            if (workResult !== OK) break;
        }
    }
    delete creep.data.actionName;
    delete creep.data.targetId;
    return workResult;
};
