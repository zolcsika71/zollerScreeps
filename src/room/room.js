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
            for (let key of Object.keys(Room._ext)) {
                if (Room._ext[key].executeRoom) Room._ext[key].executeRoom(memory, roomName);
            }
            let room = Game.rooms[roomName];
            if (room) { // has sight
                if (room.collapsed) {
                    let p2 = GLOBAL.util.startProfiling(roomName + 'execute', {enabled: global.PROFILING.ROOMS});
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
        if (Game.time % global.MEMORY_RESYNC_INTERVAL === 0 && !Game.rooms[roomName] && typeof Memory.rooms[roomName].hostile !== 'boolean') {
            // clean up stale room memory for rooms no longer in use, but preserve manually set 'hostile' entries
            delete Memory.rooms[roomName];
        }
    });
};
mod.routeCallback = function (origin, destination, options) {
    if (_.isUndefined(origin) || _.isUndefined(destination))
        GLOBAL.util.logError('Room.routeCallback', 'both origin and destination must be defined - origin:' + origin + ' destination:' + destination);
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
mod.rebuildCostMatrix = function (roomName) {
    if (global.DEBUG)
        GLOBAL.util.logSystem(roomName, 'Invalidating costmatrix to force a rebuild when we have vision.');
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
    return Room.calcCoordinates(roomName, (x,y) => {
        return x > 3 && x < 7 && y > 3 && y < 7 && (x !== 5 || y !== 5);
    });
};
mod.isHighwayRoom = function (roomName) {
    return Room.calcCoordinates(roomName, (x,y) => {
        return x === 0 || y === 0;
    });
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

mod.Containers = function (room) {
    this.room = room;
    Object.defineProperties(this, {
        'all': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._container)) {
                    this._container = [];
                    let add = entry => {
                        let cont = Game.getObjectById(entry.id);
                        if (cont) {
                            _.assign(cont, entry);
                            this._container.push(cont);
                        }
                    };
                    _.forEach(this.room.memory.container, add);
                }
                return this._container;
            }
        },
        'controller': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._controller)) {
                    if (this.room.my && this.room.controller.memory.storage) {
                        this._controller = [Game.getObjectById(this.room.controller.memory.storage)];
                        if (!this._controller[0]) delete this.room.controller.memory.storage;
                    } else {
                        let byType = c => c.controller == true;
                        this._controller = _.filter(this.all, byType);
                    }
                }
                return this._controller;
            }
        },
        'in': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._in)) {
                    let byType = c => c.controller == false;
                    this._in = _.filter(this.all, byType);
                    // add managed
                    let isFull = c => c.sum >= (c.storeCapacity * (1 - MANAGED_CONTAINER_TRIGGER));
                    this._in = this._in.concat(this.managed.filter(isFull));
                }
                return this._in;
            }
        },
        'out': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._out)) {
                    let byType = c => c.controller == true;
                    this._out = _.filter(this.all, byType);
                    // add managed
                    let isEmpty = c => c.sum <= (c.storeCapacity * MANAGED_CONTAINER_TRIGGER);
                    this._out = this._out.concat(this.managed.filter(isEmpty));
                }
                return this._out;
            }
        },
        'privateers': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._privateers)) {
                    let byType = c => (c.source === false && !c.mineral && c.sum < c.storeCapacity);
                    this._privateers = _.filter(this.all, byType);
                }
                return this._privateers;
            }
        },
        'managed': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._managed)) {
                    let byType = c => c.source === true && c.controller == true;
                    this._managed = _.filter(this.all, byType);
                }
                return this._managed;
            }
        }
    });
};

// Container related Room variables go here

// New Room methods go here

