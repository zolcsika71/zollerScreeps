"use strict";

let setup = new Creep.Setup('upgrader');
module.exports = setup;
setup.minControllerLevel = 2;
setup.maxMulti = function (room) {
    let multi = 0;
    const charge = room.storage && room.storage.active ? room.storage.charge : 0;
    if (!room.storage || (room.storage.active && charge > 0))
        multi++;
    if (!room.storage || (room.storage.active && charge > 0.5))
        multi++;
    if (room.storage && room.storage.active && charge >= 1) {
        let surplus = room.storage.store.energy - MAX_STORAGE_ENERGY[room.controller.level];
        multi += Math.ceil(surplus / 20000); // one more multi for each 20k surplus (+1)
    }
    return Math.min(11, multi);
};
setup.maxCount = function (room) {
    const add = _.get(room, ['memory', 'addUpgrader'], 0);

    //console.log(`add: ${add}`);

    // Don't spawn upgrader if...
    if (    // Room under attack
        room.situation.invasion ||
        // Energy reserves are low
        room.conserveForDefense ||
        // No energy structures built near controller
        (room.structures.container.controller.length + room.structures.links.controller.length) === 0 ||
        // Upgrading blocked -> http://support.screeps.com/hc/en-us/articles/207711889-StructureController#upgradeBlocked
        room.controller.upgradeBlocked ||
        // don't spawn a new upgrader while there are construction sites (and no storage)
        (room.myConstructionSites.length > 0 && !room.storage)
    ) return 0;
    if (room.controller.level === 8) return 1;
    // if there is no energy for the upgrader return 0
    let upgraderEnergy = 0;
    let sumCont = cont => upgraderEnergy += cont.store.energy;
    room.structures.container.controller.forEach(sumCont);
    let sumLink = link => upgraderEnergy += link.energy;
    room.structures.links.controller.forEach(sumLink);
    if (upgraderEnergy === 0) return 0;
    if (room.storage && room.storage.active) {

        let storageFull = (room.storage.sum / room.storage.storeCapacity) > 0.9,
            energySurplus = room.controller.level < 8 && room.storage.store.energy > global.MAX_STORAGE_ENERGY[8],
            ratio = 350000;

        if (energySurplus || (storageFull && room.storage.store.energy >= global.MAX_STORAGE_ENERGY[room.controller.level]))
            ratio = 175000;

        return add + Math.max(1, Math.floor((room.storage.store.energy - global.MAX_STORAGE_ENERGY[room.controller.level]) / ratio)); //NEW LINE
    }
    // if energy on the ground next to source > 700 return 3
    if (room.droppedResources) {
        let dropped = 0;
        let isSource = pos => room.sources.some(s => s.pos.x === pos.x && s.pos.y === pos.y);
        let countNearSource = resource => {
            if (resource.resourceType === RESOURCE_ENERGY) {
                if (resource.pos.adjacent.some(isSource)) dropped += resource.amount;
            }
        };
        room.droppedResources.forEach(countNearSource);
        //if(dropped > 700) return add + 3;
    }
    return add + 2;
};

setup.addRCL = function (room) {

    console.log(`${room.name} controller level: ${room.controller.level}`);

    return room.controller.level + 1;

};

setup.level2 = {
    fixedBody: {
        [CARRY]: 1,
        [MOVE]: 1,
        [WORK]: 2
    },
    multiBody: {
        [MOVE]: 1,
        [WORK]: 1
    },
    minAbsEnergyAvailable: 300,
    minEnergyAvailable: 1,
    maxMulti: room => setup.maxMulti(room),
    maxCount: room => setup.maxCount(room)
};
setup.level3 = {
    fixedBody: {
        [CARRY]: 1,
        [MOVE]: 1,
        [WORK]: 2
    },
    multiBody: {
        [MOVE]: 1,
        [WORK]: 2  // WORK: room => setup.addRCL(room),  // EDITABLE
    },
    minAbsEnergyAvailable: 400,
    minEnergyAvailable: 0.5,
    maxMulti: room => setup.maxMulti(room),
    maxCount: room => setup.maxCount(room)
};
setup.level4 = {
    fixedBody: {
        [CARRY]: 1,
        [MOVE]: 1,
        [WORK]: 2
    },
    multiBody: {
        [MOVE]: 1,
        [WORK]: 2  // WORK: room => setup.addRCL(room),  // EDITABLE
    },
    minAbsEnergyAvailable: 400,
    minEnergyAvailable: 0.5,
    maxMulti: room => setup.maxMulti(room),
    maxCount: room => setup.maxCount(room)
};
setup.level5 = {
    fixedBody: {
        [CARRY]: 1,
        [MOVE]: 1,
        [WORK]: 2
    },
    multiBody: {
        [MOVE]: 1,
        [WORK]: 3  // WORK: room => setup.addRCL(room),  // EDITABLE
    },
    minAbsEnergyAvailable: 400,
    minEnergyAvailable: 0.5,
    maxMulti: room => setup.maxMulti(room),
    maxCount: room => setup.maxCount(room)
};
setup.level8 = {
    fixedBody: {
        [CARRY]: 1,
        [MOVE]: 3
    },
    multiBody: [WORK],
    minAbsEnergyAvailable: 1700,
    minEnergyAvailable: 0.5,
    maxMulti: CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER,
    maxCount: 1
};
setup.RCL = {
    1: setup.none,
    2: setup.level2,
    3: setup.level3,
    4: setup.level4,
    5: setup.level5,
    6: setup.level5,
    7: setup.level5,
    8: setup.level8
};
