"use strict";

const
    ROOT = {
        mainInjection: require(`./mainInjection`)
    };

let mod = {};
module.exports = mod;

mod.pathfinderCache = {};
mod.pathfinderCacheDirty = false;
mod.pathfinderCacheLoaded = false;
mod.COSTMATRIX_CACHE_VERSION = global.COMPRESS_COST_MATRICES ? 4 : 5; // change this to invalidate previously cached costmatrices

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
    const p = global.Util.startProfiling('Room.analyze', {enabled: global.PROFILING.ROOMS});
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
    const p = global.Util.startProfiling('Room.execute', {enabled: global.PROFILING.ROOMS});
    // run execute in each of our submodules
    for (let key of Object.keys(Room._ext))
        if (Room._ext[key].execute) Room._ext[key].execute();

    let run = (memory, roomName) => {
        try {
            // run executeRoom in each of our submodules
            for (let key of Object.keys(Room._ext)) {
                if (Room._ext[key].executeRoom) Room._ext[key].executeRoom(memory, roomName);
            }
            let room = Game.rooms[roomName];
            if (room) { // has sight
                if (room.collapsed) {
                    let p2 = global.Util.startProfiling(roomName + 'execute', {enabled: global.PROFILING.ROOMS});
                    Room.collapsed.trigger(room);
                    p2.checkCPU('collapsed', 0.5);
                }
            }
        } catch (e) {
            global.logError(e.stack || e.message);
        }
    };
    _.forEach(Memory.rooms, (memory, roomName) => {
        run(memory, roomName);
        p.checkCPU(roomName + '.run', 1);
        if (Game.time % global.MEMORY_RESYNC_INTERVAL === 0 && !Game.rooms[roomName] && typeof Memory.rooms[roomName].hostile !== 'boolean') {
            // clean up stale room memory for rooms no longer in use, but preserve manually set 'hostile' entries
            delete Memory.rooms[roomName];
        }
    });
};
mod.cleanup = function () {
    // run cleanup in each of our submodules
    for (const key of Object.keys(Room._ext)) {
        if (Room._ext[key].cleanup) Room._ext[key].cleanup();
    }
    // flush changes to the pathfinderCache but wait until load
    if (!_.isUndefined(Memory.pathfinder)) {
        OCSMemory.saveSegment(MEM_SEGMENTS.COSTMATRIX_CACHE, Memory.pathfinder);
        delete Memory.pathfinder;
    }
    if (Room.pathfinderCacheDirty && Room.pathfinderCacheLoaded) {
        // store our updated cache in the memory segment
        let encodedCache = {};
        for (let key in Room.pathfinderCache) {
            let entry = Room.pathfinderCache[key];
            if (entry.version === Room.COSTMATRIX_CACHE_VERSION) {
                encodedCache[key] = {
                    serializedMatrix: entry.serializedMatrix || (global.COMPRESS_COST_MATRICES ?
                        CompressedMatrix.serialize(entry.costMatrix) : entry.costMatrix.serialize()),
                    updated: entry.updated,
                    version: entry.version
                };
                // only set memory when we need to
                if (entry.stale) encodedCache[key].stale = true;
            }
        }
        ROOT.ocsMemory.saveSegment(global.MEM_SEGMENTS.COSTMATRIX_CACHE, encodedCache);
        Room.pathfinderCacheDirty = false;
    }
};
mod.routeCallback = function (origin, destination, options) {
    if (_.isUndefined(origin) || _.isUndefined(destination))
        global.logError('Room.routeCallback', 'both origin and destination must be defined - origin:' + origin + ' destination:' + destination);
    return function (roomName) {
        if (Game.map.getRoomLinearDistance(origin, roomName) > options.restrictDistance)
            return false;
        if (roomName !== destination && global.ROUTE_ROOM_COST[Game.shard.name] && global.ROUTE_ROOM_COST[Game.shard.name][roomName]) {
            return global.ROUTE_ROOM_COST[Game.shard.name][roomName];
        }
        let isHighway = false;
        if (options.preferHighway) {
            const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
            isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
        }
        let isMyOrNeutralRoom = false,
            hostile = _.get(Memory.rooms[roomName], 'hostile', false);
        if (options.checkOwner) {
            let room = Game.rooms[roomName];
            // allow for explicit overrides of hostile rooms using hostileRooms[roomName] = false
            isMyOrNeutralRoom = !hostile || (room && room.controller && (room.controller.my || room.controller.owner === undefined));
        }
        if (!options.allowSK && mod.isSKRoom(roomName)) return 10;
        if (!options.allowHostile && hostile &&
            roomName !== destination && roomName !== origin) {
            return Number.POSITIVE_INFINITY;
        }
        if (isMyOrNeutralRoom || roomName == origin || roomName == destination)
            return 1;
        else if (isHighway)
            return 3;
        else if (Game.map.isRoomAvailable(roomName))
            return (options.checkOwner || options.preferHighway) ? 11 : 1;
        return Number.POSITIVE_INFINITY;
    };
};
mod.getCostMatrix = function (roomName) {
    var room = Game.rooms[roomName];
    if (!room) return;
    return room.costMatrix;
};
mod.isMine = function (roomName) {
    let room = Game.rooms[roomName];
    return (room && room.my);
};
mod.calcCardinalDirection = function (roomName) {
    const parsed = /^([WE])[0-9]+([NS])[0-9]+$/.exec(roomName);
    return [parsed[1], parsed[2]];
};
mod.calcGlobalCoordinates = function (roomName, callBack) {
    if (!callBack) return null;
    const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
    let x = +parsed[1],
        y = +parsed[2];

    return callBack(x, y);
};
mod.calcCoordinates = function (roomName, callBack) {
    if (!callBack) return null;
    return Room.calcGlobalCoordinates(roomName, (x, y) => {
        return callBack(x % 10, y % 10);
    });
};
mod.isCenterRoom = function (roomName) {
    return Room.calcCoordinates(roomName, (x,y) => {
        return x === 5 && y === 5;
    });
};
mod.isCenterNineRoom = function (roomName) {
    if (roomName === 'sim')
        return false;

    return Room.calcCoordinates(roomName, (x,y) => {
            return x > 3 && x < 7 && y > 3 && y < 7;
        });
};
mod.isControllerRoom = function (roomName) {
    return Room.calcCoordinates(roomName, (x,y) => {
        return x !== 0 && y !== 0 && (x < 4 || x > 6 || y < 4 || y > 6);
    });
};
mod.isSKRoom = function (roomName) {
    if (roomName === 'sim')
        return false;
    return Room.calcCoordinates(roomName, (x,y) => {
        return x > 3 && x < 7 && y > 3 && y < 7 && (x !== 5 || y !== 5);
    });
};
mod.isHighwayRoom = function (roomName) {
    return Room.calcCoordinates(roomName, (x,y) => {
        return x === 0 || y === 0;
    });
};
mod.adjacentRooms = function (roomName) {
    let parts = roomName.split(/([NESW])/);
    let dirs = ['N','E','S','W'];
    let toggle = q => dirs[ (dirs.indexOf(q) + 2) % 4 ];
    let names = [];
    for (let x = parseInt(parts[2]) - 1; x < parseInt(parts[2]) + 2; x++) {
        for (let y = parseInt(parts[4]) - 1; y < parseInt(parts[4]) + 2; y++) {
            names.push((x < 0 ? toggle(parts[1]) + '0' : parts[1] + x) + (y < 0 ? toggle(parts[3]) + '0' : parts[3] + y));
        }
    }
    return names;
};
mod.adjacentAccessibleRooms = function (roomName, diagonal = true) {
    let validRooms = [];
    let exits = Game.map.describeExits(roomName);
    let addValidRooms = (roomName, direction) => {
        if (diagonal) {
            let roomExits = Game.map.describeExits(roomName);
            let dirA = (direction + 1) % 8 + 1;
            let dirB = (direction + 5) % 8 + 1;
            if (roomExits && roomExits[dirA] && !validRooms.includes(roomExits[dirA]))
                validRooms.push(roomExits[dirA]);
            if (roomExits && roomExits[dirB] && !validRooms.includes(roomExits[dirB]))
                validRooms.push(roomExits[dirB]);
        }
        validRooms.push(roomName);
    };
    _.forEach(exits, addValidRooms);
    return validRooms;
};
mod.roomDistance = function (roomName1, roomName2, diagonal, continuous) {
    if (diagonal) return Game.map.getRoomLinearDistance(roomName1, roomName2, continuous);
    if (roomName1 == roomName2) return 0;
    let posA = roomName1.split(/([NESW])/);
    let posB = roomName2.split(/([NESW])/);
    let xDif = posA[1] == posB[1] ? Math.abs(posA[2] - posB[2]) : posA[2] + posB[2] + 1;
    let yDif = posA[3] == posB[3] ? Math.abs(posA[4] - posB[4]) : posA[4] + posB[4] + 1;
    //if( diagonal ) return Math.max(xDif, yDif); // count diagonal as 1
    return xDif + yDif; // count diagonal as 2
};
mod.rebuildCostMatrix = function (roomName) {
    if (global.DEBUG)
        global.logSystem(roomName, 'Invalidating costmatrix to force a rebuild when we have vision.');
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
mod.getCachedStructureMatrix = function (roomName) {
    const cacheValid = (roomName) => {
        if (_.isUndefined(Room.pathfinderCache)) {
            Room.pathfinderCache = {};
            Room.pathfinderCache[roomName] = {};
            return false;
        } else if (_.isUndefined(Room.pathfinderCache[roomName])) {
            Room.pathfinderCache[roomName] = {};
            return false;
        }
        let mem = Room.pathfinderCache[roomName],
            ttl = Game.time - mem.updated;
        if (mem.version === Room.COSTMATRIX_CACHE_VERSION && (mem.serializedMatrix || mem.costMatrix) && !mem.stale && ttl < COST_MATRIX_VALIDITY) {
            if (global.DEBUG && global.TRACE)
                global.trace('PathFinder', {roomName: roomName, ttl, PathFinder: 'CostMatrix'}, 'cached costmatrix');
            return true;
        }
        return false;
    };

    if (cacheValid(roomName)) {
        let cache = Room.pathfinderCache[roomName];
        if (cache.costMatrix) {
            return cache.costMatrix;
        } else if (cache.serializedMatrix) {
            // disabled until the CPU efficiency can be improved
            let costMatrix = global.COMPRESS_COST_MATRICES ? CompressedMatrix.deserialize(cache.serializedMatrix) : PathFinder.CostMatrix.deserialize(cache.serializedMatrix);
            cache.costMatrix = costMatrix;
            return costMatrix;
        } else {
            global.logError('Room.getCachedStructureMatrix', `Cached costmatrix for ${roomName} is invalid ${cache}`);
            delete Room.pathfinderCache[roomName];
        }
    }
};
mod.getStructureMatrix = function (roomName, options) {
    const room = Game.rooms[roomName];
    let matrix;
    if (Room.isSKRoom(roomName) && options.avoidSKCreeps) {
        matrix = _.get(room, 'avoidSKMatrix');
    } else {
        matrix = _.get(room, 'structureMatrix');
    }

    if (!matrix) {
        matrix = _.get(Room.getCachedStructureMatrix(roomName), 'costMatrix');
    }

    return matrix;
};
mod.validFields = function (roomName, minX, maxX, minY, maxY, checkWalkable = false, where = null) {
    const
        room = Game.rooms[roomName],
        look = checkWalkable ? room.lookAtArea(minY, minX, maxY, maxX) : null;

    let fields = [];

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                if (!checkWalkable || room.isWalkable(x, y, look)) {
                    let p = new RoomPosition(x, y, roomName);
                    if (!where || where(p))
                        fields.push(p);
                }
            }
        }
    }
    return fields;
};
mod.fieldsInRange = function (args) {
    let plusRangeX = args.spots.map(spot => spot.pos.x + spot.range);
    let plusRangeY = args.spots.map(spot => spot.pos.y + spot.range);
    let minusRangeX = args.spots.map(spot => spot.pos.x - spot.range);
    let minusRangeY = args.spots.map(spot => spot.pos.y - spot.range);
    let minX = Math.max(...minusRangeX);
    let maxX = Math.min(...plusRangeX);
    let minY = Math.max(...minusRangeY);
    let maxY = Math.min(...plusRangeY);
    return Room.validFields(args.roomName, minX, maxX, minY, maxY, args.checkWalkable, args.where);
};
mod.shouldRepair = function (room, structure) {
    return (
        // is not at 100%
        structure.hits < structure.hitsMax &&
        // not owned room or hits below RCL repair limit
        (!room.my || structure.hits < global.MAX_REPAIR_LIMIT[room.controller.level] || structure.hits < (global.LIMIT_URGENT_REPAIRING + (2 * global.DECAY_AMOUNT[structure.structureType] || 0))) &&
        // not decayable or below threshold
        (!DECAYABLES.includes(structure.structureType) || (structure.hitsMax - structure.hits) > global.GAP_REPAIR_DECAYABLE) &&
        // not pavement art
        (Memory.pavementArt[room.name] === undefined || Memory.pavementArt[room.name].indexOf('x' + structure.pos.x + 'y' + structure.pos.y + 'x') < 0) &&
        // not flagged for removal
        (!FlagDir.list.some(f => f.roomName == structure.pos.roomName && f.color == COLOR_ORANGE && f.x == structure.pos.x && f.y == structure.pos.y))
    );
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






// from room.construction
mod.roomLayoutArray =
    [[,,,,,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION],
    [,,,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_TOWER,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD],
    [,,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_SPAWN,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD],
    [,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_TOWER,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD],
    [,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION],
    [STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_NUKER,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION],
    [STRUCTURE_ROAD,STRUCTURE_TOWER,STRUCTURE_EXTENSION,STRUCTURE_SPAWN,STRUCTURE_ROAD,STRUCTURE_POWER_SPAWN,STRUCTURE_LINK,STRUCTURE_TERMINAL,STRUCTURE_ROAD,STRUCTURE_OBSERVER,STRUCTURE_EXTENSION,STRUCTURE_TOWER,STRUCTURE_ROAD],
    [STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_STORAGE,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION],
    [,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION],
    [,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_TOWER,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_EXTENSION,STRUCTURE_ROAD],
    [,,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_SPAWN,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD],
    [,,,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_TOWER,STRUCTURE_ROAD,STRUCTURE_EXTENSION,STRUCTURE_ROAD],
    [,,,,,STRUCTURE_EXTENSION,STRUCTURE_ROAD,STRUCTURE_EXTENSION]];

mod.roomLayout = function (flag) {
    if (!Flag.compare(flag, global.FLAG_COLOR.command.roomLayout)) return;
    flag = Game.flags[flag.name];
    const room = flag.room;
    if (!room) return;
    let layout = Room.roomLayoutArray,
        constructionFlags = {
        [STRUCTURE_SPAWN]: global.FLAG_COLOR.construct.spawn,
        [STRUCTURE_TOWER]: global.FLAG_COLOR.construct.tower,
        [STRUCTURE_EXTENSION]: global.FLAG_COLOR.construct,
        [STRUCTURE_LINK]: global.FLAG_COLOR.construct.link,
        [STRUCTURE_STORAGE]: global.FLAG_COLOR.construct.storage,
        [STRUCTURE_TERMINAL]: global.FLAG_COLOR.construct.terminal,
        [STRUCTURE_NUKER]: global.FLAG_COLOR.construct.nuker,
        [STRUCTURE_POWER_SPAWN]: global.FLAG_COLOR.construct.powerSpawn,
        [STRUCTURE_OBSERVER]: global.FLAG_COLOR.construct.observer
    };

    let [centerX, centerY] = [flag.pos.x, flag.pos.y],
        placed = [],
        sites = [],
        failed = () => {
        flag.pos.newFlag(global.FLAG_COLOR.command.invalidPosition, 'NO_ROOM');
        flag.remove();
        return false;
    };

    for (let x = 0; x < layout.length; x++) {
        for (let y = 0; y < layout[x].length; y++) {
            let xPos = Math.floor(centerX + (x - layout.length / 2) + 1),
                yPos = Math.floor(centerY + (y - layout.length / 2) + 1);
            if (xPos >= 50 || xPos < 0 || yPos >= 50 || yPos < 0)
                return failed();

            let pos = room.getPositionAt(xPos, yPos),
                structureType = layout[x] && layout[x][y];

            if (structureType) {

                let terrain = Game.map.getRoomTerrain(room.name);
                if (terrain.get(xPos, yPos) === TERRAIN_MASK_WALL)
                    return failed();

                if (structureType === STRUCTURE_ROAD)
                    sites.push(pos);

                else {
                    let flagColour = constructionFlags[structureType];
                    placed.push({
                        flagColour, pos
                    });
                }
            }
        }
    }

    placed.forEach(f => {
        f.pos.newFlag(f.flagColour);
    });
    _.forEach(sites, p => {
        if (_.size(Game.constructionSites) >= 100)
            return false;
        p.createConstructionSite(STRUCTURE_ROAD);
    });

    flag.remove();
};



