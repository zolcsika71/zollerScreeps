"use strict";

// save original API functions
let find = Room.prototype.find;

let mod = {};
module.exports = mod;
mod.extend = function () {

    // run extend in each of our room submodules
    for (let key of Object.keys(Room._ext))
        if (Room._ext[key].extend)
            Room._ext[key].extend();


    Room.prototype.checkRCL = function () {
        if (!this.controller) return;
        if (this.memory.RCL !== this.controller.level) {
            Room.RCLChange.trigger(this);
            this.memory.RCL = this.controller.level;
        }
    };

    Room.prototype.checkNuked = function () {
        if (!this.nuked)
            return false;
        else {
            Room.nuked.trigger(this);
        }
    };

    Room.prototype.countMySites = function () {
        const numSites = _.size(this.myConstructionSites);
        if (!_.isUndefined(this.memory.myTotalSites) && numSites !== this.memory.myTotalSites) {
            Room.costMatrixInvalid.trigger(this);
        }
        if (numSites > 0) this.memory.myTotalSites = numSites;
        else delete this.memory.myTotalSites;
    };

    Room.prototype.getBorder = function (roomName) {
        return _.findKey(Game.map.describeExits(this.name), function (name) {
            return this.name === name;
        }, {name: roomName});
    };

    Room.prototype.countMyStructures = function () {
        const numStructures = _.size(this.structures.my);
        if (!_.isUndefined(this.memory.myTotalStructures) && numStructures !== this.memory.myTotalStructures) {
            Room.costMatrixInvalid.trigger(this);
            // these are vital for feeding
            this.saveExtensions();
            this.saveSpawns();
        } else delete this.memory.myTotalStructures;
    };

    Room.prototype.getBorder = function (roomName) {
        return _.findKey(Game.map.describeExits(this.name), function (name) {
            return this.name === name;
        }, {name: roomName});
    };

    Room.prototype.find = function (c, opt) {
        if (_.isArray(c)) {
            return _(c)
                .map(x => find.call(this, x, opt))
                .flatten()
                .value();
        } else
            return find.apply(this, arguments);
    };

    Room.prototype.findRoute = function (destination, checkOwner = true, preferHighway = true, allowSK = true) {
        if (this.name == destination) return [];
        const options = {checkOwner, preferHighway, allowSK};
        return Game.map.findRoute(this, destination, {
            routeCallback: Room.routeCallback(this.name, destination, options)
        });
    };

    Room.prototype.recordMove = function (creep) {
        if (!global.ROAD_CONSTRUCTION_ENABLE &&
            (!global.ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name] ||
                (global.ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name] &&
                    global.ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name].indexOf(this.name) === -1))) return;
        let x = creep.pos.x;
        let y = creep.pos.y;
        if (x === 0 || y === 0 || x === 49 || y === 49 ||
            creep.carry.energy === 0 || creep.data.actionName === 'building')
            return;

        let key = `${String.fromCharCode(32 + x)}${String.fromCharCode(32 + y)}_x${x}-y${y}`;
        if (!this.roadConstructionTrace[key])
            this.roadConstructionTrace[key] = 1;
        else this.roadConstructionTrace[key]++;
    };

    Room.prototype.isWalkable = function (x, y, look) {
        if (!look) look = this.lookAt(x, y);
        else look = look[y][x];
        let invalidObject = o => {
            return ((o.type == LOOK_TERRAIN && o.terrain == 'wall') ||
                OBSTACLE_OBJECT_TYPES.includes(o[o.type].structureType));
        };
        return look.filter(invalidObject).length == 0;
    };

    Room.prototype.exits = function (findExit, point) {
        if (point === true) point = 0.5;
        let positions;
        if (findExit === 0) {
            // portals
            positions = _.chain(this.find(FIND_STRUCTURES)).filter(function (s) {
                return s.structureType === STRUCTURE_PORTAL;
            }).map('pos').value();
        } else {
            positions = this.find(findExit);
        }

        // assuming in-order
        let maxX, maxY;
        let map = {};
        let limit = -1;
        const ret = [];
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            if (!(_.get(map, [pos.x - 1, pos.y]) || _.get(map, [pos.x, pos.y - 1]))) {
                if (point && limit !== -1) {
                    ret[limit].x += Math.ceil(point * (maxX - ret[limit].x));
                    ret[limit].y += Math.ceil(point * (maxY - ret[limit].y));
                }
                limit++;
                ret[limit] = _.pick(pos, ['x', 'y']);
                maxX = pos.x;
                maxY = pos.y;
                map = {};
            }
            _.set(map, [pos.x, pos.y], true);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
        }
        if (point && limit !== -1) {
            ret[limit].x += Math.ceil(point * (maxX - ret[limit].x));
            ret[limit].y += Math.ceil(point * (maxY - ret[limit].y));
        }
        return ret;
    }

    Room.prototype.showCostMatrix = function (matrix = this.structureMatrix, aroundPos) {
        const vis = new RoomVisual(this.name);
        let startY = 0;
        let endY = 50;
        let startX = 0;
        let endX = 50;
        if (aroundPos) {
            startY = Math.max(0, aroundPos.y - 3);
            endY = Math.min(50, aroundPos.y + 4);
            startX = Math.max(0, aroundPos.x - 3);
            endX = Math.min(50, aroundPos.x + 4);
        }
        const maxCost = _.max(matrix._bits);
        const getColourByPercentage = (value) => {
            const hue = ((1 - value) * 120).toString(10);
            return `hsl(${hue}, 100%, 50%)`;
        };
        for (var y = startY; y < endY; y++) {
            for (var x = startX; x < endX; x++) {
                const cost = matrix.get(x, y);
                if (cost) vis.text(cost, x, y);
                vis.rect(x - 0.5, y - 0.5, 1, 1, {fill: getColourByPercentage(cost / maxCost)});
            }
        }
    };

    // toAvoid - a list of creeps to avoid sorted by owner
    Room.prototype.getAvoidMatrix = function (toAvoid) {
        const avoidMatrix = this.structureMatrix.clone();
        for (const owner in toAvoid) {
            const creeps = toAvoid[owner];
            for (const creep of creeps) {
                for (let x = Math.max(0, creep.pos.x - 3); x <= Math.min(49, creep.pos.x + 3); x++) {
                    const deltaX = x < creep.pos.x ? creep.pos.x - x : x - creep.pos.x;
                    for (let y = Math.max(0, creep.pos.y - 3); y <= Math.min(49, creep.pos.y + 3); y++) {
                        if (this.isWalkable(x, y)) {
                            const deltaY = y < creep.pos.y ? creep.pos.y - y : y - creep.pos.y;
                            const cost = 17 - (2 * Math.max(deltaX, deltaY));
                            avoidMatrix.set(x, y, cost) // make it less desirable than a swamp
                        }
                    }
                }
            }
        }
        return avoidMatrix;
    };

    Room.prototype.invalidateCostMatrix = function () {
        Room.costMatrixInvalid.trigger(this.name);
    };

    Room.prototype.highwayHasWalls = function () {
        if (!Room.isHighwayRoom(this.name)) return false;
        return !!_.find(this.getPositionAt(25, 25).lookFor(LOOK_STRUCTURES), s => s instanceof StructureWall);
    };

    Room.prototype.isTargetAccessible = function (object, target) {
        if (!object || !target) return;
        // Checks. Accept RoomObject, RoomPosition, and mock position
        if (object instanceof RoomObject) object = object.pos;
        if (target instanceof RoomObject) target = target.pos;
        for (const prop of ['x', 'y', 'roomName']) {
            if (!Reflect.has(object, prop) || !Reflect.has(target, prop)) return;
        }

        if (!Room.isHighwayRoom(this.name)) return;
        if (!this.highwayHasWalls()) return true;

        const [x, y] = Room.calcCoordinates(this.name, (x, y) => [x, y]);

        const getVerHalf = o => Math.floor(o.x / 25) === 0 ? LEFT : RIGHT;

        const getHorHalf = o => Math.floor(o.y / 25) === 0 ? TOP : BOTTOM;

        const getQuadrant = o => {
            const verHalf = getVerHalf(o);
            const horHalf = getHorHalf(o);
            if (verHalf === LEFT) {
                return horHalf === TOP ? TOP_LEFT : BOTTOM_LEFT;
            } else {
                return horHalf === TOP ? TOP_RIGHT : BOTTOM_RIGHT;
            }
        };
        if (x % 10 === 0) {
            if (y % 10 === 0) { // corner room
                const top = !!_.find(this.getPositionAt(25, 24).lookFor(LOOK_STRUCTURES), s => s instanceof StructureWall);
                const left = !!_.find(this.getPositionAt(24, 25).lookFor(LOOK_STRUCTURES, s => s instanceof StructureWall));
                const bottom = !!_.find(this.getPositionAt(25, 26).lookFor(LOOK_STRUCTURES, s => s instanceof StructureWall));
                const right = !!_.find(this.getPositionAt(26, 25).lookFor(LOOK_STRUCTURES, s => s instanceof StructureWall));
                // both in same quadrant
                if (getQuadrant(object) === getQuadrant(target)) return true;

                if (top && left && bottom && right) {
                    // https://i.imgur.com/8lmqtbi.png
                    return getQuadrant(object) === getQuadrant(target);
                }

                if (top) {
                    if (bottom) {
                        // cross section
                        if (left) {
                            return Util.areEqual(RIGHT, getVerHalf(object), getVerHalf(target));
                        } else {
                            return Util.areEqual(LEFT, getVerHalf(object), getVerHalf(target));
                        }
                    }
                    if (left && right) {
                        // cross section
                        if (getHorHalf(object) !== getHorHalf(target)) return false;
                        return Util.areEqual(BOTTOM, getHorHalf(object), getHorHalf(target));
                    }
                    if (Util.areEqual(BOTTOM, getHorHalf(object), getHorHalf(target))) return true;
                    if (left) {
                        if (Util.areEqual(RIGHT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === TOP_LEFT && getQuadrant(target) !== TOP_LEFT) return false;
                    } else {
                        if (Util.areEqual(LEFT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === TOP_RIGHT && getQuadrant(target) !== TOP_RIGHT) return false;
                    }
                } else {
                    if (left && right) {
                        // cross section
                        if (getHorHalf(object) !== getHorHalf(target)) return false;
                        return Util.areEqual(TOP, getHorHalf(object), getHorHalf(target));
                    }
                    if (Util.areEqual(TOP, getHorHalf(object), getHorHalf(target))) return true;
                    if (left) {
                        if (Util.areEqual(RIGHT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === BOTTOM_LEFT && getQuadrant(target) !== BOTTOM_LEFT) return false;
                    } else {
                        if (Util.areEqual(LEFT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === BOTTOM_RIGHT && getQuadrant(target) !== BOTTOM_RIGHT) return false;
                    }
                }
                return true;
            }
            if (getVerHalf(object) === getVerHalf(target)) return true;
        }
        if (y % 10 === 0) {
            if (getHorHalf(object) === getHorHalf(target)) return true;
        }
        return true;
    };

    Room.prototype.targetAccessible = function (target) {
        if (!target) return;
        if (target instanceof RoomObject) target = target.pos;
        for (const prop of ['x', 'y', 'roomName']) {
            if (!Reflect.has(target, prop)) return;
        }
        if (!Room.isHighwayRoom(this.name)) return;
        if (!this.highwayHasWalls()) return true;

        const closestRoom = _(Game.rooms).filter('my').min(r => Game.map.getRoomLinearDistance(r.name, this.name));
        if (closestRoom === Infinity) return;

        const [x1, y1] = Room.calcGlobalCoordinates(this.name, (x, y) => [x, y]);
        const [x2, y2] = Room.calcGlobalCoordinates(closestRoom, (x, y) => [x, y]);
        let dir = '';
        if (y1 - y2 < 0) {
            dir += 'south';
        } else if (y1 - y2 > 0) {
            dir += 'north';
        }
        if (x1 - x2 < 0) {
            dir += 'east';
        } else if (x1 - x2 > 0) {
            dir += 'west';
        }
        if (x1 % 10 === 0) {
            if (y1 % 10 === 0) {
                // corner room
                if (dir.includes('south') && dir.includes('east')) {
                    return this.isTargetAccessible(this.getPositionAt(49, 49), target);
                }
                if (dir.includes('south') && dir.includes('west')) {
                    return this.isTargetAccessible(this.getPositionAt(0, 49), target);
                }
                if (dir.includes('north') && dir.includes('east')) {
                    return this.isTargetAccessible(this.getPositionAt(49, 0), target);
                }
                if (dir.includes('north') && dir.includes('west')) {
                    return this.isTargetAccessible(this.getPositionAt(0, 0), target);
                }
            }
            if (dir.includes('east')) {
                return this.isTargetAccessible(this.getPositionAt(49, 25), target);
            }
        }
        if (y1 % 10 === 0) {
            if (dir.includes('south')) {
                return this.isTargetAccessible(this.getPositionAt(25, 49), target);
            }
            if (dir.includes('north')) {
                return this.isTargetAccessible(this.getPositionAt(25, 0), target);
            }
        }
        return true;
    };

    Room.prototype.getCreepMatrix = function (structureMatrix = this.structureMatrix) {
        if (_.isUndefined(this._creepMatrix)) {
            const costs = structureMatrix.clone();
            // Avoid creeps in the room
            this.allCreeps.forEach(function (creep) {
                costs.set(creep.pos.x, creep.pos.y, 0xff);
            });
            this._creepMatrix = costs;
        }
        return this._creepMatrix;
    };

    // other prototypes go here

    // from room.spawn
    Room.prototype.saveSpawns = function () {
        let spawns = this.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            let id = o => o.id;
            this.memory.spawns = _.map(spawns, id);
        } else delete this.memory.spawns;
    };

    // from room.defense
    Room.prototype.processInvaders = function () {
        let that = this;
        if (this.memory.hostileIds === undefined)
            this.memory.hostileIds = [];
        if (!global.SEND_STATISTIC_REPORTS) delete this.memory.statistics;
        else if (this.memory.statistics === undefined) {
            this.memory.statistics = {};
        }

        let registerHostile = creep => {
            if (Room.isCenterNineRoom(this.name)) return;
            // if invader id unregistered
            if (!that.memory.hostileIds.includes(creep.id)) {
                // handle new invader
                // register
                that.memory.hostileIds.push(creep.id);
                // save to trigger subscribers later
                that.newInvader.push(creep);
                // create statistics
                if (global.SEND_STATISTIC_REPORTS) {
                    let bodyCount = JSON.stringify(_.countBy(creep.body, 'type'));
                    if (that.memory.statistics.invaders === undefined)
                        that.memory.statistics.invaders = [];
                    that.memory.statistics.invaders.push({
                        owner: creep.owner.username,
                        id: creep.id,
                        body: bodyCount,
                        enter: Game.time,
                        time: Date.now()
                    });
                }
            }
        };
        _.forEach(this.hostiles, registerHostile);

        let registerHostileLeave = id => {
            const creep = Game.getObjectById(id);
            const stillHostile = creep && Task.reputation.hostileOwner(creep);
            // for each known invader
            if (!stillHostile) {
                // save to trigger subscribers later
                that.goneInvader.push(id);
                // update statistics
                if (global.SEND_STATISTIC_REPORTS && that.memory.statistics && that.memory.statistics.invaders !== undefined && that.memory.statistics.invaders.length > 0) {
                    let select = invader => invader.id == id && invader.leave === undefined;
                    let entry = _.find(that.memory.statistics.invaders, select);
                    if (entry != undefined) entry.leave = Game.time;
                }
            }
        };
        _.forEach(this.memory.hostileIds, registerHostileLeave);

        this.memory.hostileIds = this.hostileIds;
    };
    Room.prototype.registerIsHostile = function () {
        if (this.controller) {
            if (_.isUndefined(this.hostile) || typeof this.hostile === 'number') { // not overridden by user
                if (this.controller.owner && !this.controller.my && !this.ally) {
                    this.memory.hostile = this.controller.level;
                } else {
                    delete this.memory.hostile;
                }
            }
        }
    };

    //room.container
    Room.prototype.saveContainers = function () {
        let containers = this.structures.all.filter(
            structure => structure.structureType == STRUCTURE_CONTAINER
        );
        if (containers.length > 0) {
            this.memory.container = [];
            let add = (cont) => {
                // TODO consolidate managed container code
                let minerals = this.find(FIND_MINERALS);
                let source = cont.pos.findInRange(this.sources, 2);
                let mineral = cont.pos.findInRange(minerals, 2);
                let isControllerContainer = !!(this.my && cont.pos.getRangeTo(this.controller) <= 4);
                this.memory.container.push({
                    id: cont.id,
                    source: (source.length > 0),
                    controller: isControllerContainer,
                    mineral: (mineral.length > 0)
                });
                let assignContainer = s => s.memory.container = cont.id;
                source.forEach(assignContainer);
                mineral.forEach(assignContainer);
            };
            containers.forEach(add);
        } else delete this.memory.container;

        if (this.terminal) {
            // terminal in range <= 2 is too simplistic for certain room placements near sources. See #681
            // This solution finds all walkable source fields in a room, then compares adjacency with the terminal
            // The first room position adjacent to the terminal is remapped back to it's adjacent source for mapping to terminal
            let minerSpots = [];
            let findValidFields = s => {
                minerSpots = _(minerSpots).concat(Room.validFields(this.name, s.pos.x - 1, s.pos.x + 1, s.pos.y - 1, s.pos.y + 1, true));
            };
            _.forEach(this.sources, findValidFields);
            let sourceField = this.terminal.pos.findClosestByRange(minerSpots, 1);
            let source = [];
            if (sourceField) {
                if (this.sources.length == 1) {
                    source = this.sources;
                } else {
                    source.push(sourceField.isNearTo(this.sources[0]) ? this.sources[0] : this.sources[1]);
                }
            }

            let mineral = this.terminal.pos.findInRange(this.minerals, 2);
            let assignTerminal = s => s.memory.terminal = this.terminal.id;
            source.forEach(assignTerminal);
            mineral.forEach(assignTerminal);

            if (this.terminal.pos.getRangeTo(this.controller) < 4) {
                this.controller.memory.storage = this.terminal.id;
            }
        }
        if (this.storage) {
            let source = this.storage.pos.findInRange(this.sources, 2);
            let mineral = this.storage.pos.findInRange(this.minerals, 2);
            let assignStorage = s => s.memory.storage = this.storage.id;
            source.forEach(assignStorage);
            mineral.forEach(assignStorage);

            if (this.storage.pos.getRangeTo(this.controller) < 4)
                this.controller.memory.storage = this.storage.id;
        }
    };
    Room.prototype.findContainerWith = function (resourceType, amountMin) {
        if (!amountMin) amountMin = 1;
        //if (!RESOURCES_ALL.find((r)=>{r==resourceType;})) return null;

        let data = this.memory;
        if (data && data.container && data.container.length > 0) {
            for (let i = 0; i < data.container.length; i++) {
                let d = data.container[i];
                let container = Game.getObjectById(d.id);
                if (container) {
                    let amt = -container.getNeeds(resourceType);
                    if (!(this.structures.container.out.includes(container) && resourceType === RESOURCE_ENERGY) && amt > 0) {
                        let amount = amt;
                        if (amount >= amountMin) return { structure: container, amount: amount };
                    }
                }
            }
        }

        return null;
    };

    // from room.construction
    Room.prototype.getBestConstructionSiteFor = function (pos, filter = null) {
        let sites;
        if (filter) sites = this.constructionSites.filter(filter);
        else sites = this.constructionSites;
        if (sites.length == 0) return null;
        let siteOrder = Util.fieldOrFunction(CONSTRUCTION_PRIORITY, this);
        let rangeOrder = site => {
            let order = siteOrder.indexOf(site.structureType);
            return pos.getRangeTo(site) + (order < 0 ? 100000 : (order * 100));
            //if( order < 0 ) return 100000 + pos.getRangeTo(site);
            //return ((order - (site.progress / site.progressTotal)) * 100) + pos.getRangeTo(site);
        };
        return _.min(sites, rangeOrder);
    };
    Room.prototype.roadConstruction = function (minDeviation = ROAD_CONSTRUCTION_MIN_DEVIATION) {
        const forced = ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name] && ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name].indexOf(this.name) != -1;
        if ((!ROAD_CONSTRUCTION_ENABLE && !forced) || Game.time % ROAD_CONSTRUCTION_INTERVAL != 0) return;
        if (!forced && (_.isNumber(ROAD_CONSTRUCTION_ENABLE) && (!this.my || ROAD_CONSTRUCTION_ENABLE > this.controller.level))) return;

        let data = Object.keys(this.roadConstructionTrace)
        .map(k => {
            return { // convert to [{key,n,x,y}]
                'n': this.roadConstructionTrace[k], // count of steps on x,y cordinates
                'x': k.charCodeAt(0) - 32, // extract x from key
                'y': k.charCodeAt(1) - 32 // extraxt y from key
            };
        });

        let min = Math.max(ROAD_CONSTRUCTION_ABS_MIN, (data.reduce((_sum, b) => _sum + b.n, 0) / data.length) * minDeviation);
        data = data.filter(e => {
            if (e.n >= min) {
                let structures = this.lookForAt(LOOK_STRUCTURES, e.x, e.y);
                return (structures.length === 0 || structures[0].structureType === STRUCTURE_RAMPART)
                    && this.lookForAt(LOOK_CONSTRUCTION_SITES, e.x, e.y).length === 0;
            } else {
                return false;
            }
        });

        // build roads on all most frequent used fields
        let setSite = pos => {
            if (global.DEBUG) logSystem(this.name, `Constructing new road at ${pos.x}'${pos.y} (${pos.n} traces)`);
            this.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
        };
        _.forEach(data, setSite);

        // clear old data
        this.roadConstructionTrace = {};
    };
    Room.prototype.processConstructionFlags = function () {
        if (!this.my || !Util.fieldOrFunction(SEMI_AUTOMATIC_CONSTRUCTION, this)) return;
        let sitesSize = _.size(Game.constructionSites);
        if (sitesSize >= 100) return;
        const LEVEL = this.controller.level;
        const POS = new RoomPosition(25, 25, this.name);
        const ARGS = [POS, true];
        const CONSTRUCT = (flag, type) => {
            if (sitesSize >= 100) return;
            if (!flag) return;
            const POS = new RoomPosition(flag.x, flag.y, flag.roomName);
            if (!POS) return;
            const sites = POS.lookFor(LOOK_CONSTRUCTION_SITES);
            if (sites && sites.length) return; // already a construction site
            const structures = POS.lookFor(LOOK_STRUCTURES).filter(s => !(s instanceof StructureRoad || s instanceof StructureRampart));
            if (structures && structures.length) return; // pre-existing structure here
            const r = POS.createConstructionSite(type);
            if (Util.fieldOrFunction(REMOVE_CONSTRUCTION_FLAG, this, type) && r === OK) {
                if (flag.name) {
                    flag = Game.flags[flag.name];
                    if (flag instanceof Flag) flag.remove();
                }
                sitesSize++;
            }
        };

        // Extensions
        let shortAmount = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][LEVEL] - (this.structures.extensions.length + _.filter(this.constructionSites, s => s.structureType === STRUCTURE_EXTENSION).length);
        if (shortAmount > 0) {
            FlagDir.filter(FLAG_COLOR.construct, ...ARGS).splice(0, shortAmount).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_EXTENSION);
            });
        }

        // Spawns
        shortAmount = CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][LEVEL] - (this.structures.spawns.length + _.filter(this.constructionSites, s => s.structureType === STRUCTURE_SPAWN).length);
        if (shortAmount > 0) {
            FlagDir.filter(FLAG_COLOR.construct.spawn, ...ARGS).splice(0, shortAmount).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_SPAWN);
            });
        }

        // Towers
        shortAmount = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][LEVEL] - (this.structures.towers.length + _.filter(this.constructionSites, s => s.structureType === STRUCTURE_TOWER).length);
        if (shortAmount > 0) {
            FlagDir.filter(FLAG_COLOR.construct.tower, ...ARGS).splice(0, shortAmount).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_TOWER);
            });
        }

        // Links
        shortAmount = CONTROLLER_STRUCTURES[STRUCTURE_LINK][LEVEL] - (this.structures.links.all.length + _.filter(this.constructionSites, s => s.structureType === STRUCTURE_LINK).length);
        if (shortAmount > 0) {
            FlagDir.filter(FLAG_COLOR.construct.link, ...ARGS).splice(0, shortAmount).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_LINK);
            });
        }

        // Labs
        shortAmount = CONTROLLER_STRUCTURES[STRUCTURE_LAB][LEVEL] - (this.structures.labs.all.length + _.filter(this.constructionSites, s => s.structureType === STRUCTURE_LAB).length);
        if (shortAmount > 0) {
            FlagDir.filter(FLAG_COLOR.construct.lab, ...ARGS).splice(0, shortAmount).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_LAB);
            });
        }

        // Storage
        if (!this.storage && CONTROLLER_STRUCTURES[STRUCTURE_STORAGE][LEVEL] > 0) {
            FlagDir.filter(FLAG_COLOR.construct.storage, ...ARGS).splice(0, 1).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_STORAGE);
            });
        }

        // Terminal
        if (!this.terminal && CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL][LEVEL] > 0) {
            FlagDir.filter(FLAG_COLOR.construct.terminal, ...ARGS).splice(0, 1).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_TERMINAL);
            });
        }

        // Observer
        if (!this.structures.observer && CONTROLLER_STRUCTURES[STRUCTURE_OBSERVER][LEVEL] > 0) {
            FlagDir.filter(FLAG_COLOR.construct.observer, ...ARGS).splice(0, 1).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_OBSERVER);
            });
        }

        // Nuker
        if (!this.structures.nuker && CONTROLLER_STRUCTURES[STRUCTURE_NUKER][LEVEL] > 0) {
            FlagDir.filter(FLAG_COLOR.construct.nuker, ...ARGS).splice(0, 1).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_NUKER);
            });
        }

        // Power Spawn
        if (!this.structures.powerSpawn && CONTROLLER_STRUCTURES[STRUCTURE_POWER_SPAWN][LEVEL] > 0) {
            FlagDir.filter(FLAG_COLOR.construct.powerSpawn, ...ARGS).splice(0, 1).forEach(flag => {
                CONSTRUCT(flag, STRUCTURE_POWER_SPAWN);
            });
        }

        // Extractor
        if (CONTROLLER_STRUCTURES[STRUCTURE_EXTRACTOR][LEVEL] > 0) {
            const [mineral] = this.find(FIND_MINERALS);
            const extractor = mineral.pos.lookFor(LOOK_STRUCTURES);
            if (extractor.length && extractor[0] instanceof StructureExtractor) return;
            CONSTRUCT(mineral.pos, STRUCTURE_EXTRACTOR);
        }
    };

    //from room.link
    Room.prototype.saveLinks = function () {
        let links = this.find(FIND_MY_STRUCTURES, {
            filter: (structure) => (structure.structureType == STRUCTURE_LINK)
        });
        if (links.length > 0) {
            this.memory.links = [];
            let storageLinks = this.storage ? this.storage.pos.findInRange(links, 2).map(l => l.id) : [];

            // for each memory entry, keep if existing
            /*
            let kept = [];
            let keep = (entry) => {
                if( links.find( (c) => c.id == entry.id )){
                    entry.storage = storageLinks.includes(entry.id);
                    kept.push(entry);
                }
            };
            this.memory.links.forEach(keep);
            this.memory.links = kept;
            */
            this.memory.links = [];

            // for each link add to memory ( if not contained )
            let add = (link) => {
                // TODO consolidate managed container code
                if (!this.memory.links.find((l) => l.id == link.id)) {
                    let isControllerLink = (link.pos.getRangeTo(this.controller) <= 4);
                    let isSource = false;
                    if (!isControllerLink) {
                        let source = link.pos.findInRange(this.sources, 2);
                        let assign = s => s.memory.link = link.id;
                        source.forEach(assign);
                        isSource = source.length > 0;
                    }
                    this.memory.links.push({
                        id: link.id,
                        storage: storageLinks.includes(link.id),
                        controller: isControllerLink,
                        source: isSource
                    });
                }
            };
            links.forEach(add);
        } else delete this.memory.links;
    };
    Room.prototype.linkDispatcher = function () {
        let filled = l => l.cooldown == 0 && l.energy >= (l.energyCapacity * (l.source ? 0.85 : 0.5));
        let empty = l =>  l.energy < l.energyCapacity * 0.15;
        let filledIn = this.structures.links.in.filter(filled);
        let emptyController = this.structures.links.controller.filter(empty);

        if (filledIn.length > 0) {
            let emptyStorage = this.structures.links.storage.filter(empty);

            let handleFilledIn = f => { // first fill controller, then storage
                if (emptyController.length > 0) {
                    f.transferEnergy(emptyController[0]);
                    emptyController.shift();
                } else if (emptyStorage.length > 0) {
                    f.transferEnergy(emptyStorage[0]);
                    emptyStorage.shift();
                }
            };
            filledIn.forEach(handleFilledIn);
        }

        if (emptyController.length > 0) { // controller still empty, send from storage
            let filledStorage = this.structures.links.storage.filter(filled);
            let handleFilledStorage = f => {
                if (emptyController.length > 0) {
                    f.transferEnergy(emptyController[0]);
                    emptyController.shift();
                }
            };
            filledStorage.forEach(handleFilledStorage);
        }
    };

    // from room.extension
    Room.prototype.saveExtensions = function() {
        const extensions = this.find(FIND_MY_STRUCTURES, {
            filter: s => s instanceof StructureExtension
        }).map(s => s.id);
        if (extensions.length > 0)
            this.memory.extensions = extensions;
        else
            delete this.memory.extensions;
    };

    // from room.lab
    Room.prototype.autoRegisterLabs = function () {

        let data = this.memory.resources,
            numberOfLabs = this.structures.labs.all.length;

        if (numberOfLabs === 3 && !global.MAKE_REACTIONS_WITH_3LABS)
            return;

        if (_.isUndefined(data))
            return;

        // create Memory object
        if (!_.isUndefined(data) && _.isUndefined(data.seedCheck))
            data.seedCheck = {
                numberOfLabs: numberOfLabs,
                flowerRegisterChecked: false
            };
        // fill new labs with energy
        if (data.seedCheck.numberOfLabs !== numberOfLabs)
            _.values(Game.structures).filter(i => i.structureType === 'lab' && i.room.name === this.name).map(i => i.room.setStore(i.id, RESOURCE_ENERGY, 2000));

        // if some labs are registered, check if it is ok, register otherwise
        if (data && data.reactions && data.reactions.seed_a && data.reactions.seed_b) {

            if ((data.seedCheck.numberOfLabs !== numberOfLabs && (numberOfLabs === 3 || numberOfLabs === 6 || numberOfLabs === 10)) || !data.seedCheck.flowerRegisterChecked) {
                if (this.flowerRegisterCheck()) {
                    data.seedCheck.numberOfLabs = numberOfLabs;
                    data.seedCheck.flowerRegisterChecked = true;
                    global.logSystem(this, `room labs correctly registered. flowerRegisterChecked: true`);
                } else if (numberOfLabs === 3 || numberOfLabs === 6 || numberOfLabs === 10) {
                    global.logSystem(this, `room labs are under registration`);
                    Util.resetBoostProduction(this.name);
                    this.registerFlower();
                }
            }
        }
        // no seeds are registered
        else if (numberOfLabs === 3 || numberOfLabs === 6 || numberOfLabs === 10) {
            global.logSystem(this, `room labs are under registration`);
            Util.resetBoostProduction(this.name);
            this.registerFlower();
        }
    };
    Room.prototype.flowerRegisterCheck = function () {

        let data = this.memory.resources,
            numberOfLabs = this.structures.labs.all.length,
            seed_a = Game.getObjectById(data.reactions.seed_a),
            seed_b = Game.getObjectById(data.reactions.seed_b),
            counter = 0;

        for (let lab of this.structures.labs.all) {
            if (lab.id === seed_a.id || lab.id === seed_b.id)
                continue;
            if (lab.pos.inRangeTo(seed_a, 2) && lab.pos.inRangeTo(seed_b, 2))
                counter++;
        }

        return counter === numberOfLabs - 2;

    };
    Room.prototype.registerFlower = function () {

        let that = this,
            findSeed = function () {
                let seeds = [],
                    counter = 0,
                    labs = that.structures.labs.all,
                    numberOfLabs = labs.length;

                for (let seedCandidate of labs) {
                    for (let lab of labs) {
                        if (lab.id === seedCandidate.id)
                            continue;
                        if (lab.pos.inRangeTo(seedCandidate, 2))
                            counter++;
                    }
                    if (counter === numberOfLabs - 1)
                        seeds.push(seedCandidate.id);
                    counter = 0;
                }
                return seeds;
            },
            seeds = findSeed();

        if (seeds.length >= 2) {
            this.registerReactorFlower(seeds[0], seeds[1]);
            global.logSystem(this, `auto-registering reactor flower SUCCEED`);
            global.logSystem(this, `seeds are: `);
            global.logSystem(this, `${seeds[0]}, ${seeds [1]}`);
        } else {
            global.logSystem(this, `auto-registering reactor flower FAILED`);
            global.logSystem(this, `possible seeds are:`);
            global.BB(seeds);
        }
    };
    Room.prototype.saveLabs = function(){
        let labs = this.find(FIND_MY_STRUCTURES, {
            filter: (structure) => ( structure.structureType == STRUCTURE_LAB )
        });
        if (labs.length > 0) {
            this.memory.labs = [];
            let storageLabs = this.storage ? this.storage.pos.findInRange(labs, 2).map(l => l.id) : [];

            this.memory.labs = [];

            // for each entry add to memory ( if not contained )
            let add = (lab) => {
                let labData = this.memory.labs.find( (l) => l.id == lab.id );
                if( !labData ) {
                    this.memory.labs.push({
                        id: lab.id,
                        storage: storageLabs.includes(lab.id),
                    });
                }
            };
            labs.forEach(add);
        } else delete this.memory.labs;
    };
    Room.prototype.processLabs = function() {
        // only process labs every 10 turns and avoid room tick
        let labs = this.find(FIND_MY_STRUCTURES, { filter: (s) => { return s.structureType == STRUCTURE_LAB; } } );
        let data = this.memory.resources;
        if (!data) return;
        let timing;
        if (!data.reactions || data.reactions.orders.length === 0 || data.boostTiming.roomState !== 'reactionMaking')
            timing = Game.time % 10 !== 5;
        else
            timing = Game.time % REACTION_TIME[data.reactions.orders[0].type] === 0;

        if (!timing) return;
        // run basic reactions
        let master_labs = labs.filter( (l) => {
            let data = this.memory.resources.lab.find( (s) => s.id == l.id );
            return data ? (data.slave_a && data.slave_b) : false;
        } );
        for (let i=0;i<master_labs.length;i++) {
            // see if the reaction is possible
            let master = master_labs[i];
            if (master.cooldown > 0) continue;
            let data = data.lab.find( (s) => s.id == master.id );
            if (!data) continue;
            let compound = data.reactionType;
            if (master.mineralAmount > 0 && master.mineralType != compound) continue;
            let slave_a = Game.getObjectById(data.slave_a);
            let slave_b = Game.getObjectById(data.slave_b);
            if (!slave_a || slave_a.mineralType != LAB_REACTIONS[compound][0] || !slave_b || slave_b.mineralType != LAB_REACTIONS[compound][1]) continue;

            if (master.runReaction(slave_a, slave_b) == OK) {
                data.reactionAmount -= LAB_REACTION_AMOUNT;
                if( global.DEBUG && global.TRACE ) trace("Room", { roomName: this.name, actionName: "processLabs", labId: master.id, resourceType: compound, amountRemaining: data.reactionAmount } );
                if (data.reactionAmount <= 0) {
                    this.cancelReactionOrder(master.id);
                }
            }
        }

        // run reactors
        let reactions = data.reactions;
        if ( !reactions ) return;
        switch ( reactions.reactorType ) {
            case REACTOR_TYPE_FLOWER:
                this.processReactorFlower();
                break;
            default:
                break;
        }
    };
    Room.prototype.processReactorFlower = function() {
        let data = this.memory.resources.reactions;
        if ( !data || data.reactorType !== REACTOR_TYPE_FLOWER ) return;

        // find and qualify reaction order
        for (let i=0;i<data.orders.length;i++) {
            if (data.orders[i].amount < LAB_REACTION_AMOUNT ) {
                data.orders.splice( i--, 1 );
            } else {
                break;
            }
        }
        if ( data.orders.length === 0 ) {
            // reset labs so they get emptied
            let labs = this.find(FIND_MY_STRUCTURES, { filter: (s) => { return s.structureType == STRUCTURE_LAB; } } );
            for (let i=0;i<labs.length;i++) {
                let lab = labs[i];
                let data = this.memory.resources.lab.find( s => s.id === lab.id );
                if ( data && ( data.reactionState === LAB_IDLE || data.reactionState === LAB_SEED ) ) {
                    this.cancelReactionOrder(lab.id);
                }
            }
            data.reactorMode = REACTOR_MODE_IDLE;
            return;
        }
        let order = data.orders[0];
        data.reactorMode = order.mode;

        switch ( data.reactorMode ) {
            case REACTOR_MODE_BURST:
                this.processReactorFlowerBurst();
                break;
            default:
                break;
        }
    };
    Room.prototype.processReactorFlowerBurst = function() {
        let data = this.memory.resources.reactions;
        if ( !data || data.reactorType !== REACTOR_TYPE_FLOWER || data.reactorMode !== REACTOR_MODE_BURST ) return;
        if (!global.MAKE_REACTIONS_WITH_3LABS && this.memory.resources.lab.length <= 3) return;

        let order = data.orders[0];
        if ( order.mode !== REACTOR_MODE_BURST ) return;
        let component_a = LAB_REACTIONS[order.type][0];
        let component_b = LAB_REACTIONS[order.type][1];
        let seed_a = Game.getObjectById(data.seed_a);
        let seed_b = Game.getObjectById(data.seed_b);
        let myRooms = _.filter(Game.rooms, {'my': true});
        let roomTradeUpdate = false;
        let labOrderPlaced = false;
        let empireResources = function (component) {
            let roomStored = 0,
                that = this;
            for (let room of myRooms) {
                if (room.name === that.name || _.isUndefined(room.terminal) || _.isUndefined(room.storage))
                    continue;
                let resourcesAll = room.resourcesAll[component] || 0;
                if (global.COMPOUNDS_TO_ALLOCATE[component] && global.COMPOUNDS_TO_ALLOCATE[component].allocate)
                    resourcesAll -= global.COMPOUNDS_TO_ALLOCATE[component].amount + global.COMPOUNDS_TO_ALLOCATE[component].roomThreshold;
                if (resourcesAll >= global.MIN_OFFER_AMOUNT)
                    roomStored += resourcesAll;
            }
            return roomStored;
        };
        let empireResourcesComponentA = empireResources(component_a);
        let empireResourcesComponentB = empireResources(component_b);

        if ( !seed_a || !seed_b ) return;

        // order components for seeds
        let data_a = this.memory.resources.lab.find( l => l.id === data.seed_a );
        let data_b = this.memory.resources.lab.find( l => l.id === data.seed_b );
        if (!data_a || !_.some(data_a.orders, 'type', component_a)) {

            this.placeOrder(data.seed_a, component_a, order.amount);
            labOrderPlaced = true;

            let resourcesStored = (this.resourcesStorage[component_a] || 0) + (this.resourcesTerminal[component_a] || 0),
                resourcesOffered = (this.resourcesOffers[component_a] || 0) + order.amount,
                amountToOrder = resourcesOffered - resourcesStored;

            let roundedAmountToOrder = global.roundUpTo(amountToOrder, global.MIN_OFFER_AMOUNT);
            if (amountToOrder < global.TRADE_THRESHOLD && amountToOrder > 0) {
                if (empireResourcesComponentA >= global.TRADE_THRESHOLD)
                    amountToOrder = global.TRADE_THRESHOLD;
                else if (empireResourcesComponentA >= roundedAmountToOrder)
                    amountToOrder = roundedAmountToOrder;
            } else if (amountToOrder > 0 && roundedAmountToOrder <= empireResourcesComponentA)
                amountToOrder = roundedAmountToOrder;

            if (amountToOrder > 0 && amountToOrder <= empireResourcesComponentA) {
                this.placeRoomOrder(data.seed_a, component_a, amountToOrder);
                roomTradeUpdate = true;
            }

            data_a = this.memory.resources.lab.find( l => l.id === data.seed_a );
            data_a.reactionType = component_a;
        }
        if (!data_b || !_.some(data_b.orders, 'type', component_b)) {

            this.placeOrder(data.seed_b, component_b, order.amount);
            labOrderPlaced = true;

            let resourcesStored = (this.resourcesStorage[component_b] || 0) + (this.resourcesTerminal[component_b] || 0),
                resourcesOffered = (this.resourcesOffers[component_b] || 0) + order.amount,
                amountToOrder = resourcesOffered - resourcesStored;

            let roundedAmountToOrder = global.roundUpTo(amountToOrder, global.MIN_OFFER_AMOUNT);
            if (amountToOrder < global.TRADE_THRESHOLD && amountToOrder > 0) {
                if (empireResourcesComponentB >= global.TRADE_THRESHOLD)
                    amountToOrder = global.TRADE_THRESHOLD;
                else if (empireResourcesComponentB >= roundedAmountToOrder)
                    amountToOrder = roundedAmountToOrder;
            } else if (amountToOrder > 0 && roundedAmountToOrder <= empireResourcesComponentB)
                amountToOrder = roundedAmountToOrder;

            if (amountToOrder > 0 && amountToOrder <= empireResourcesComponentB) {
                this.placeRoomOrder(data.seed_b, component_b, amountToOrder);
                roomTradeUpdate = true;
            }

            data_b = this.memory.resources.lab.find( l => l.id === data.seed_b );
            data_b.reactionType = component_b;
        }
        if ( !data_a || !data_b ) return;
        let data_a_order = data_a.orders.find( o => o.type === component_a );
        let data_b_order = data_b.orders.find( o => o.type === component_b );
        if ( !data_a_order || data_a_order.amount < order.amount ) {
            let orderAmount = order.amount - (data_a_order ? data_a_order.orderAmount : 0);
            this.placeOrder(data.seed_a, component_a, orderAmount);
            labOrderPlaced = true;

            let resourcesStored = (this.resourcesStorage[component_a] || 0) + (this.resourcesTerminal[component_a] || 0),
                resourcesOffered = (this.resourcesOffers[component_a] || 0) + order.amount,
                amountToOrder = resourcesOffered - resourcesStored;

            let roundedAmountToOrder = global.roundUpTo(amountToOrder, global.MIN_OFFER_AMOUNT);
            if (amountToOrder < global.TRADE_THRESHOLD && amountToOrder > 0) {
                if (empireResourcesComponentA >= global.TRADE_THRESHOLD)
                    amountToOrder = global.TRADE_THRESHOLD;
                else if (empireResourcesComponentA >= roundedAmountToOrder)
                    amountToOrder = roundedAmountToOrder;
            } else if (amountToOrder > 0 && roundedAmountToOrder <= empireResourcesComponentA)
                amountToOrder = roundedAmountToOrder;

            if (amountToOrder > 0 && amountToOrder <= empireResourcesComponentA) {
                this.placeRoomOrder(data.seed_a, component_a, amountToOrder);
                roomTradeUpdate = true;
            }


            if (amountToOrder > 0) {
                this.placeRoomOrder(data.seed_a, component_a, amountToOrder);
                roomTradeUpdate = true;
            }
        }
        if ( !data_b_order || data_b_order.amount < order.amount ) {
            let orderAmount = order.amount - (data_b_order ? data_b_order.orderAmount : 0);
            this.placeOrder(data.seed_b, component_b, orderAmount);
            labOrderPlaced = true;

            let resourcesStored = (this.resourcesStorage[component_b] || 0) + (this.resourcesTerminal[component_b] || 0),
                resourcesOffered = (this.resourcesOffers[component_b] || 0) + order.amount,
                amountToOrder = resourcesOffered - resourcesStored;

            let roundedAmountToOrder = global.roundUpTo(amountToOrder, global.MIN_OFFER_AMOUNT);
            if (amountToOrder < global.TRADE_THRESHOLD && amountToOrder > 0) {
                if (empireResourcesComponentB >= global.TRADE_THRESHOLD)
                    amountToOrder = global.TRADE_THRESHOLD;
                else if (empireResourcesComponentB >= roundedAmountToOrder)
                    amountToOrder = roundedAmountToOrder;
            } else if (amountToOrder > 0 && roundedAmountToOrder <= empireResourcesComponentB)
                amountToOrder = roundedAmountToOrder;

            if (amountToOrder > 0 && amountToOrder <= empireResourcesComponentB) {
                this.placeRoomOrder(data.seed_b, component_b, amountToOrder);
                roomTradeUpdate = true;
            }

            if (amountToOrder > 0) {
                this.placeRoomOrder(data.seed_b, component_b, amountToOrder);
                roomTradeUpdate = true;
            }
        }

        let boostTiming = this.memory.resources.boostTiming;

        if (roomTradeUpdate) {
            boostTiming.roomState = 'ordersPlaced';
            //Memory.boostTiming.roomTrading.boostProduction = true;
            //Memory.boostTiming.timeStamp = Game.time;
            this.GCOrders();
        } else if (labOrderPlaced) {
            boostTiming.roomState = 'ordersPlaced';
        }

        // find and configure idle labs
        let labs = this.find(FIND_MY_STRUCTURES, { filter: (s) => { return s.structureType == STRUCTURE_LAB; } } );
        let reactors = labs.filter (l => {
            let data = this.memory.resources.lab.find( s => s.id === l.id );
            let reactions = this.memory.resources.reactions;
            return data ? data.reactionState === LAB_IDLE && (data.id !== reactions.seed_a || data.id !== reactions.seed_b) : true;
        });
        for (let i=0;i<reactors.length;i++) {
            let reactor = reactors[i];
            let data = this.memory.resources.lab.find( s => s.id === reactor.id );
            if ( !data ) {
                this.prepareReactionOrder(reactor.id, order.type, order.amount);
                data = this.memory.resources.lab.find( s => s.id === reactor.id );
            }
            if ( data ) data.reactionType = order.type;
        }

        // verify ability to run reactor
        if (seed_a.mineralType !== component_a || seed_b.mineralType !== component_b) return;
        let maxReactions = Math.floor(Math.min(seed_a.mineralAmount, seed_b.mineralAmount, order.amount ) / LAB_REACTION_AMOUNT);
        if (maxReactions === 0) return;

        // run reactions
        let burstReactors = 0;
        for (let i=0;i<reactors.length;i++) {
            let reactor = reactors[i];
            if (reactor.cooldown > 0)
                continue;
            if (reactor.mineralAmount === 0 || (reactor.mineralType === order.type && reactor.mineralAmount <= reactor.mineralCapacity - LAB_REACTION_AMOUNT && burstReactors < maxReactions)) {
                burstReactors++;
                // FU - SION - HA !
                let returnValue = reactor.runReaction(seed_a, seed_b);
                if (returnValue === OK) {
                    order.amount -= LAB_REACTION_AMOUNT;
                    if( global.DEBUG && global.TRACE ) trace("Room", { roomName: this.name, actionName: "processLabs", reactorType: REACTOR_TYPE_FLOWER, labId: reactor.id, resourceType: order.type, amountRemaining: order.amount } );
                } else {
                    global.logSystem(this.name, `${this.name} runReactions not OK. returnValue: ${global.translateErrorCode(returnValue)}`);
                }
            }
        }
    };
    Room.prototype.cancelReactionOrder = function(labId, dataFilter) {
        let labData = this.memory.resources.lab.find( (l) => l.id == labId );
        if ( dataFilter && !_.matches(dataFilter)(labId)) return;

        if ( labData ) {
            // clear slave reaction orders
            if (labData.slave_a) this.cancelReactionOrder(labData.slave_a, {master: labId});
            if (labData.slave_b) this.cancelReactionOrder(labData.slave_b, {master: labId});

            // clear reaction orders
            let basicStates = [ LAB_MASTER, LAB_SLAVE_1, LAB_SLAVE_2, LAB_SLAVE_3 ];
            if ( basicStates.includes(labData.reactionState) ) labData.reactionState = LAB_IDLE;
            delete labData.reactionType;
            delete labData.reactionAmount;
            delete labData.master;
            delete labData.slave_a;
            delete labData.slave_b;

            if (this.memory.resources === undefined) {
                this.memory.resources = {
                    lab: [],
                    container: [],
                    terminal: [],
                    storage: []
                };
            }
            if (this.memory.resources.orders === undefined) {
                this.memory.resources.orders = [];
            }

            let orders = this.memory.resources.orders;
            // clear local resource orders
            for (let i=0;i<labData.orders.length;i++) {
                let order = labData.orders[i];
                if (order.type == RESOURCE_ENERGY) continue;
                order.orderAmount = 0;
                order.orderRemaining = 0;
                order.storeAmount = 0;
            }
        }

        return OK;
    };
    Room.prototype.prepareReactionOrder = function(labId, resourceType, amount) {
        if (amount <= 0) return OK;
        let lab = Game.getObjectById(labId);
        if (!this.my || !lab || !lab.structureType == STRUCTURE_LAB) return ERR_INVALID_TARGET;
        if (!LAB_REACTIONS.hasOwnProperty(resourceType)) {
            return ERR_INVALID_ARGS;
        }
        if (this.memory.resources === undefined) {
            this.memory.resources = {
                lab: [],
                container: [],
                terminal: [],
                storage: []
            };
        }

        let labData = this.memory.resources.lab.find( (l) => l.id == labId );
        if ( !labData ) {
            this.memory.resources.lab.push({
                id: labId,
                orders: [],
                reactionState: LAB_IDLE
            });
            labData = this.memory.resources.lab.find( (l) => l.id == labId );
        }

        this.cancelReactionOrder(labId);

        return OK;
    };
    Room.prototype.placeBasicReactionOrder = function(labId, resourceType, amount, tier = 1) {
        if (amount <= 0) return OK;
        if (!LAB_REACTIONS.hasOwnProperty(resourceType)) {
            return ERR_INVALID_ARGS;
        }
        if (this.memory.resources === undefined) {
            this.memory.resources = {
                lab: [],
                container: [],
                terminal: [],
                storage: []
            };
        }
        if (this.memory.resources.powerSpawn === undefined) this.memory.resources.powerSpawn = [];
        let lab_master = Game.getObjectById(labId);
        let component_a = LAB_REACTIONS[resourceType][0];
        let component_b = LAB_REACTIONS[resourceType][1];
        let lab_slave_a = null;
        let lab_slave_b = null;

        // find slave labs
        let nearbyLabs = lab_master.pos.findInRange(FIND_MY_STRUCTURES, 2, {filter: (s)=>{ return s.structureType==STRUCTURE_LAB && s.id != lab_master.id; }});
        //console.log(lab_master,"found",nearbyLabs.length,"potential slave labs");
        for (let i=0;i<nearbyLabs.length;i++) {
            let lab = nearbyLabs[i];
            let data = this.memory.resources.lab.find( (l) => l.id == lab.id );
            //console.log(lab_master,"potential slave",i,"has",lab.mineralType,"and is currently",data?data.reactionState:"idle");
            if (lab_slave_a == null && data && data.reactionType == component_a) {
                lab_slave_a = lab;
            } else if (lab_slave_b == null && data && data.reactionType == component_b) {
                lab_slave_b = lab;
            }
            if (lab_slave_a && lab_slave_b) break;
        }
        if (!lab_slave_a || !lab_slave_b) {
            nearbyLabs.sort( (a,b) => lab_master.pos.getRangeTo(a) - lab_master.pos.getRangeTo(b));
            for (let i=0;i<nearbyLabs.length;i++) {
                let lab = nearbyLabs[i];
                let data = this.memory.resources.lab.find( (l) => l.id == lab.id );
                if (!data || !data.reactionState || data.reactionState == LAB_IDLE) {
                    if (lab_slave_a == null) lab_slave_a = lab;
                    else if (lab_slave_b == null) lab_slave_b = lab;
                }
            }
        }

        // qualify labs and prepare states
        if (lab_slave_a == null || lab_slave_b == null) return ERR_NOT_FOUND;
        let ret = this.prepareReactionOrder(labId, resourceType, amount);
        if (ret != OK) {
            return ret;
        }
        ret = this.prepareReactionOrder(lab_slave_a.id, resourceType, amount);
        if (ret != OK) {
            return ret;
        }
        ret = this.prepareReactionOrder(lab_slave_b.id, resourceType, amount);
        if (ret != OK) {
            return ret;
        }

        // place reaction order with master lab
        let labData = this.memory.resources.lab.find( (l) => l.id == labId );
        let state = LAB_MASTER;
        if ( labData ) {
            if (labData.reactionState == LAB_SLAVE_1) state = LAB_SLAVE_1;
            if (labData.reactionState == LAB_SLAVE_2) state = LAB_SLAVE_2;
            labData.reactionState = state;
            labData.reactionType = resourceType;
            labData.reactionAmount = amount;
            labData.slave_a = lab_slave_a.id;
            labData.slave_b = lab_slave_b.id;
        }

        // place orders with slave labs
        labData = this.memory.resources.lab.find( (l) => l.id == lab_slave_a.id );
        let slaveState = LAB_SLAVE_1;
        let slaveDepth = 1;
        if (state == LAB_SLAVE_1) {
            slaveState = LAB_SLAVE_2;
            slaveDepth = 2;
        } else if (state == LAB_SLAVE_2) {
            slaveState = LAB_SLAVE_3;
            slaveDepth = 3;
        }
        if ( labData ) {
            labData.reactionState = slaveState;
            labData.reactionType = component_a;
            labData.master = lab_master.id;
            this.placeOrder(lab_slave_a.id, component_a, amount);

            let available = 0;
            if (this.memory.container) {
                for (let i=0;i<this.memory.container.length;i++) {
                    let d = this.memory.container[i];
                    let container = Game.getObjectById(d.id);
                    if (container && container.store[component_a]) {
                        available += container.store[component_a];
                    }
                }
            }
            if (this.storage) available += this.storage.store[component_a]||0;
            if (this.terminal) available += this.terminal.store[component_a]||0;
            if (tier > slaveDepth && slaveDepth < 3 && available < amount) {
                if (this.placeReactionOrder(lab_slave_a.id,component_a,amount-available) == OK) {
                    let order = labData.orders.find((o)=>o.type==component_a);
                    if (order) order.orderRemaining = available;
                }
            }
        }
        labData = this.memory.resources.lab.find( (l) => l.id == lab_slave_b.id );
        if ( labData ) {
            labData.reactionState = slaveState;
            labData.reactionType = component_b;
            labData.master = lab_master.id;
            this.placeOrder(lab_slave_b.id, component_b, amount);

            let available = 0;
            if (this.memory.container) {
                for (let i=0;i<this.memory.container.length;i++) {
                    let d = this.memory.container[i];
                    let container = Game.getObjectById(d.id);
                    if (container) {
                        available += container.store[component_b]||0;
                    }
                }
            }
            if (this.storage) available += this.storage.store[component_b]||0;
            if (this.terminal) available += this.terminal.store[component_b]||0;
            if (tier > slaveDepth && slaveDepth < 3 && available < amount) {
                if (this.placeReactionOrder(lab_slave_a.id,component_a,amount-available) == OK) {
                    let order = labData.orders.find((o)=>o.type==component_b);
                    if (order) order.orderRemaining = available;
                }
            }
        }

        //console.log(lab_master,"found slave labs",lab_slave_a,"for",component_a,"and",lab_slave_b,"for",component_b);
        return OK;
    };
    Room.prototype.placeFlowerReactionOrder = function(orderId, resourceType, amount, mode = REACTOR_MODE_BURST) {
        if (amount <= 0) return OK;
        if (!LAB_REACTIONS.hasOwnProperty(resourceType)) {
            return ERR_INVALID_ARGS;
        }
        if (this.memory.resources === undefined) {
            this.memory.resources = {
                lab: [],
                container: [],
                terminal: [],
                storage: []
            };
        }
        if (this.memory.resources.powerSpawn === undefined) this.memory.resources.powerSpawn = [];

        let data = this.memory.resources;
        if ( data.reactions ) {
            // create reaction order
            let existingOrder = data.reactions.orders.find((o)=>{ return o.id==orderId && o.type==resourceType; });
            if ( existingOrder ) {
                // update existing order
                if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'placeReactionOrder', subAction: 'update', orderId: orderId, resourceType: resourceType, amount: amount })
                existingOrder.mode = mode;
                existingOrder.amount = amount;
            } else {
                // create new order
                if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'placeReactionOrder', subAction: 'new', orderId: orderId, resourceType: resourceType, amount: amount })
                data.reactions.orders.push({
                    id: orderId,
                    type: resourceType,
                    mode: mode,
                    amount: amount,
                });
            }
            data.reactions.reactorMode = mode;
        }

        return OK;
    };
    Room.prototype.placeReactionOrder = function(orderId, resourceType, amount, mode = REACTOR_MODE_BURST) {
        if (amount <= 0) return OK;
        if (!LAB_REACTIONS.hasOwnProperty(resourceType)) {
            return ERR_INVALID_ARGS;
        }
        if (this.memory.resources === undefined) {
            this.memory.resources = {
                lab: [],
                container: [],
                terminal: [],
                storage: []
            };
        }
        if (this.memory.resources.powerSpawn === undefined) this.memory.resources.powerSpawn = [];

        let lab_master = Game.getObjectById(orderId);
        if ( lab_master && lab_master.structureType === STRUCTURE_LAB ) {
            return this.placeBasicReactionOrder(orderId, resourceType, amount, 1);
        }

        let data = this.memory.resources;
        if ( data.reactions ) {
            let reactorType = data.reactions.reactorType;
            switch ( data.reactions.reactorType ) {
                case REACTOR_TYPE_FLOWER:
                    this.placeFlowerReactionOrder(orderId, resourceType, amount, mode);
                    break;
                default:
                    break;
            }
        } else {
            if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'placeRoomOrder', subAction: 'no_reactor' })
            return ERR_INVALID_TARGET;
        }

        return OK;
    };
    Room.prototype.registerReactorFlower = function(seed_a_id, seed_b_id) {
        if ( this.memory.resources === undefined ) {
            this.memory.resources = {
                lab: [],
                container: [],
                terminal: [],
                storage: []
            };
        }
        if ( this.memory.resources.powerSpawn === undefined ) this.memory.resources.powerSpawn = [];

        let seed_a = Game.getObjectById(seed_a_id);
        let seed_b = Game.getObjectById(seed_b_id);
        if ( !seed_a || !seed_b || seed_a.structureType !== STRUCTURE_LAB || seed_b.structureType !== STRUCTURE_LAB ) return ERR_INVALID_TARGET;

        let data = this.memory.resources;
        if ( data.reactions === undefined ) data.reactions = {
            orders: [],
        };
        data.reactions.reactorType = REACTOR_TYPE_FLOWER;
        data.reactions.reactorMode = REACTOR_MODE_IDLE;
        data.reactions.seed_a = seed_a_id;
        data.reactions.seed_b = seed_b_id;

        data_a = data.lab.find( l => l.id === seed_a_id );
        if ( data_a ) {
            data_a.reactionState = LAB_SEED;
        }
        data_b = data.lab.find( l => l.id === seed_b_id );
        if ( data_b ) {
            data_b.reactionState = LAB_SEED;
        }

        return OK;
    };

};

