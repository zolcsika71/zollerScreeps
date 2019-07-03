"use strict";

const
    GLOBAL = {
        util: require(`./global.util`)
    };


let mod = {};
module.exports = mod;
mod.priorityHigh = [
    Creep.setup.worker,
    Creep.setup.miner,
    Creep.setup.hauler,
    Creep.setup.upgrader
];
mod.priorityLow = [
    Creep.setup.mineralMiner,
    Creep.setup.privateer
];

mod.register = function () {
    Creep.spawningCompleted.on(creep => mod.handleSpawningCompleted(creep));
};
mod.handleSpawningCompleted = function (creep) {
    if (global.DEBUG && global.TRACE)
        GLOBAL.util.trace('Spawn', {behaviour: creep.data.creepType, creepName: creep.name, Spawn: 'Creep.spawningCompleted'});
    if (global.CENSUS_ANNOUNCEMENTS)
        GLOBAL.util.logSystem(creep.pos.roomName, global.dye(global.CRAYON.birth, 'Off to work ' + creep.name + '!'));
};
mod.execute = function () {
    let run = spawn => {
        if (spawn.room.my)
            spawn.execute();
    };
    _.forEach(Game.spawns, run);
};


