"use strict";

const
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    },
    ROOT = {
        mainInjection: require(`./mainInjection`)
    };


// save original API functions
let find = Room.prototype.find;
let mod = {};

mod.register = function () {
    // run register in each of our submodules
    for (const key of Object.keys(Room._ext)) {
        if (Room._ext[key].register) Room._ext[key].register();
    }
    Room.costMatrixInvalid.on(room => mod.rebuildCostMatrix(room.name || room));
    Room.RCLChange.on(room => room.structures.all.filter(s => ![STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART].includes(s.structureType)).forEach(s => {
        if (!s.isActive()) _.set(room.memory, ['structures', s.id, 'active'], false);
    }));
};
module.exports = mod;
mod.pathfinderCache = {};
mod.pathfinderCacheLoaded = false;

mod.flush = function () {
    // run flush in each of our submodules
    for (const key of Object.keys(Room._ext)) {
        if (Room._ext[key].flush) Room._ext[key].flush();
    }
    let clean = room => {
        for (const key of Object.keys(Room._ext)) {
            if (Room._ext[key].flushRoom) Room._ext[key].flushRoom(room);
        }
    };
    _.forEach(Game.rooms, clean);
};
mod.totalSitesChanged = function () {
    let numSites = _.size(Game.constructionSites),
        oldSites = Memory.rooms.myTotalSites || 0;

    if (numSites > 0)
        Memory.rooms.myTotalSites = numSites;
    else
        delete Memory.rooms.myTotalSites;

    return oldSites && oldSites !== numSites;
};
mod.totalStructuresChanged = function () {
    let numStructures = _.size(Game.structures),
        oldStructures = Memory.rooms.myTotalStructures || 0;
    if (numStructures > 0)
        Memory.rooms.myTotalStructures = numStructures;
    else delete
        Memory.rooms.myTotalStructures;

    return oldStructures && oldStructures !== numStructures;
};
mod.needMemoryResync = function (room) {
    if (_.isUndefined(room.memory.initialized)) {
        room.memory.initialized = Game.time;
        return true;
    }
    return Game.time % global.MEMORY_RESYNC_INTERVAL === 0 || room.name === 'sim';
};

mod.analyze = function () {
    const p = GLOBAL.util.startProfiling('Room.analyze', {enabled: global.PROFILING.ROOMS});
    // run analyze in each of our submodules
    for (let key of Object.keys(Room._ext)) {
        if (Room._ext[key].analyze) Room._ext[key].analyze();
    }
    let totalSitesChanged = mod.totalSitesChanged(),
        totalStructuresChanged = mod.totalStructuresChanged(),
        getEnvironment = room => {
        try {
            let needMemoryResync = mod.needMemoryResync(room);
            // run analyzeRoom in each of our submodules
            for (const key of Object.keys(Room._ext)) {
                if (Room._ext[key].analyzeRoom) Room._ext[key].analyzeRoom(room, needMemoryResync);
            }
            if (totalSitesChanged)
                room.countMySites();
            if (totalStructuresChanged)
                room.countMyStructures();
            room.checkRCL();
        }
        catch (err) {
            Game.notify('Error in room.js (Room.prototype.loop) for "' + room.name + '" : ' + err.stack ? err + '<br/>' + err.stack : err);
            console.log(global.dye(global.CRAYON.error, 'Error in room.js (Room.prototype.loop) for "' + room.name + '": <br/>' + (err.stack || err.toString()) + '<br/>' + err.stack));
        }
    };
    _.forEach(Game.rooms, r => {
        if (r.skip)
            return;
        getEnvironment(r);
        p.checkCPU(r.name, global.PROFILING.ANALYZE_LIMIT / 5);
    });
};
mod.rebuildCostMatrix = function (roomName) {
    if (global.DEBUG)
        GLOBAL.global.logSystem(roomName, 'Invalidating costmatrix to force a rebuild when we have vision.');
    _.set(Room, ['pathfinderCache', roomName, 'stale'], true);
    _.set(Room, ['pathfinderCache', roomName, 'updated'], Game.time);
    Room.pathfinderCacheDirty = true;
};
mod.loadCostMatrixCache = function (cache) {
    let count = 0;
    for (const key in cache) {
        if (!mod.pathfinderCache[key] || mod.pathfinderCache[key].updated < cache[key].updated) {
            count++;
            mod.pathfinderCache[key] = cache[key];
        }
    }
    if (global.DEBUG && count > 0)
        global.logSystem('RawMemory', 'loading pathfinder cache.. updated ' + count + ' stale entries.');
    mod.pathfinderCacheLoaded = true;
};

