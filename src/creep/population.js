"use strict";

let mod = {};
module.exports = mod;

mod.setCreep = function (val) {
    Memory.population[val.creepName] = val;
    return Memory.population[val.creepName];
};



mod.countCreep = function (room, entry) {
    entry.roomName = room.name;
    if (room.population === undefined) {
        room.population = {
            typeCount: {},
            typeWeight: {},
            actionCount: {},
            actionWeight: {}
        };
    }

    if (room.population.typeCount[entry.creepType] === undefined)
        room.population.typeCount[entry.creepType] = 1;
    else
        room.population.typeCount[entry.creepType]++;

    if (room.population.typeWeight[entry.creepType] === undefined)
        room.population.typeWeight[entry.creepType] = entry.weight;
    else
        room.population.typeWeight[entry.creepType] += entry.weight;

    if (this.typeCount[entry.creepType] === undefined)
        this.typeCount[entry.creepType] = 1;
    else
        this.typeCount[entry.creepType]++;

    if (this.typeWeight[entry.creepType] === undefined)
        this.typeWeight[entry.creepType] = entry.weight;
    else
        this.typeWeight[entry.creepType] += entry.weight;
};

