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

};

