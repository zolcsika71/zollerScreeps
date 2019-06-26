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
mod.execute = function () {
    const p = GLOBAL.util.startProfiling('Room.execute', {enabled: global.PROFILING.ROOMS});
    // run execute in each of our submodules
    for (let key of Object.keys(Room._ext))
        if (Room._ext[key].execute) Room._ext[key].execute();

    let run = (memory, roomName) => {
        try {
            // run executeRoom in each of our submodules
            for (const key of Object.keys(Room._ext)) {
                if (Room._ext[key].executeRoom) Room._ext[key].executeRoom(memory, roomName);
            }
            const room = Game.rooms[roomName];
            if (room) { // has sight
                if (room.collapsed) {
                    const p2 = GLOBAL.util.startProfiling(roomName + 'execute', {enabled: global.PROFILING.ROOMS});
                    Room.collapsed.trigger(room);
                    p2.checkCPU('collapsed', 0.5);
                }
            }
        } catch (e) {
            GLOBAL.util.logError(e.stack || e.message);
        }
    };
    _.forEach(Memory.rooms, (memory, roomName) => {
        run(memory, roomName);
        p.checkCPU(roomName + '.run', 1);
        if (Game.time % MEMORY_RESYNC_INTERVAL === 0 && !Game.rooms[roomName] && typeof Memory.rooms[roomName].hostile !== 'boolean') {
            // clean up stale room memory for rooms no longer in use, but preserve manually set 'hostile' entries
            delete Memory.rooms[roomName];
        }
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


// from room.spawn
mod.bestSpawnRoomFor = function (targetRoomName) {
    var range = room => room.my ? routeRange(room.name, targetRoomName) : Infinity;
    return _.min(Game.rooms, range);
};

// find a room to spawn
// params: { targetRoom, minRCL = 0, maxRange = Infinity, minEnergyAvailable = 0, minEnergyCapacity = 0, callBack = null, allowTargetRoom = false, rangeRclRatio = 3, rangeQueueRatio = 51 }
// requiredParams: targetRoom
mod.findSpawnRoom = function (params) {
    if (!params || !params.targetRoom) return null;
    // filter validRooms
    let isValidRoom = room => (
        room.my &&
        (params.maxRange === undefined || Util.routeRange(room.name, params.targetRoom) <= params.maxRange) &&
        (params.minEnergyCapacity === undefined || params.minEnergyCapacity <= room.energyCapacityAvailable) &&
        (params.minEnergyAvailable === undefined || params.minEnergyAvailable <= room.energyAvailable) &&
        (room.name != params.targetRoom || params.allowTargetRoom === true) &&
        (params.minRCL === undefined || room.controller.level >= params.minRCL) &&
        (params.callBack === undefined || params.callBack(room))
    );
    let validRooms = _.filter(Game.rooms, isValidRoom);
    if (validRooms.length == 0) return null;
    // select "best"
    // range + roomLevelsUntil8/rangeRclRatio + spawnQueueDuration/rangeQueueRatio
    let queueTime = queue => _.sum(queue, c => (c.parts.length * 3));
    let roomTime = room => ((queueTime(room.spawnQueueLow) * 0.9) + queueTime(room.spawnQueueMedium) + (queueTime(room.spawnQueueHigh) * 1.1)) / room.structures.spawns.length;
    let evaluation = room => {
        return routeRange(room.name, params.targetRoom) +
               ((8 - room.controller.level) / (params.rangeRclRatio || 3)) +
               (roomTime(room) / (params.rangeQueueRatio || 51));
    };
    return _.min(validRooms, evaluation);
};

