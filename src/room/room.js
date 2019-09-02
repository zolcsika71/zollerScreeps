"use strict";

let mod = {};
module.exports = mod;

mod.pathfinderCache = {};
mod.pathfinderCacheDirty = false;
mod.pathfinderCacheLoaded = false;
mod.COSTMATRIX_CACHE_VERSION = global.COMPRESS_COST_MATRICES ? 4 : 5; // change this to invalidate previously cached costmatrices

mod.extend = () => {

    let Structures = function (room) {
        this.room = room;
        Object.defineProperties(this, {
            'all': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._all)) {
                        this._all = this.room.find(FIND_STRUCTURES);
                    }
                    return this._all;
                }
            },
            'my': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._my)) {
                        this._my = this.room.find(FIND_MY_STRUCTURES);
                    }
                    return this._my;
                }
            },
            'towers': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._towers)) {
                        this._towers = [];
                        var add = id => {
                            addById(this._towers, id);
                        };
                        _.forEach(this.room.memory.towers, add);
                    }
                    return this._towers;
                }
            },
            'repairable': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._repairable)) {
                        let that = this;
                        this._repairable = _.sortBy(
                            that.all.filter(
                                structure => Room.shouldRepair(that.room, structure)
                            ),
                            'hits'
                        );
                    }
                    return this._repairable;
                }
            },
            'urgentRepairable': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._urgentRepairableSites)) {
                        var isUrgent = site => (site.hits < (LIMIT_URGENT_REPAIRING + (DECAY_AMOUNT[site.structureType] || 0)));
                        this._urgentRepairableSites = _.filter(this.repairable, isUrgent);
                    }
                    return this._urgentRepairableSites;
                }
            },
            'feedable': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._feedable)) {
                        this._feedable = this.extensions.concat(this.spawns);
                    }
                    return this._feedable;
                }
            },
            'fortifyable': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._fortifyableSites)) {
                        let that = this;
                        this._fortifyableSites = _.sortBy(
                            that.all.filter(
                                structure => (
                                    that.room.my &&
                                    structure.hits < structure.hitsMax &&
                                    structure.hits < global.MAX_FORTIFY_LIMIT[that.room.controller.level] &&
                                    (structure.structureType !== STRUCTURE_CONTAINER || structure.hits < global.MAX_FORTIFY_CONTAINER) &&
                                    (!global.DECAYABLES.includes(structure.structureType) || (structure.hitsMax - structure.hits) > global.GAP_REPAIR_DECAYABLE * 3) &&
                                    (Memory.pavementArt[that.room.name] === undefined || Memory.pavementArt[that.room.name].indexOf(`x${structure.pos.x}y${structure.pos.y}x`) < 0) &&
                                    (!global.FlagDir.list.some(f => f.roomName === structure.pos.roomName && f.color === COLOR_ORANGE && f.x === structure.pos.x && f.y === structure.pos.y))
                                )
                            ),
                            'hits'
                        );
                    }
                    return this._fortifyableSites;
                }
            },
            'fuelable': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._fuelables)) {
                        let that = this,
                            factor = that.room.situation.invasion ? 1 : 0.82,
                            fuelable = target => (target.energy < (target.energyCapacity * factor));
                        this._fuelables = _.sortBy(_.filter(this.towers, fuelable), 'energy') ; // TODO: Add Nuker
                    }
                    return this._fuelables;
                }
            },
            'container' : {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._container)) {
                        this._container = new Room.Containers(this.room);
                    }
                    return this._container;
                }
            },
            'links' : {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._links)) {
                        this._links = new Room.Links(this.room);
                    }
                    return this._links;
                }
            },
            'labs' : {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._labs)) {
                        this._labs = new Room.Labs(this.room);
                    }
                    return this._labs;
                }
            },
            'virtual': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._virtual)) {
                        this._virtual = _(this.all).concat(this.piles);
                    }
                    return this._virtual;
                }
            },
            'piles': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._piles)) {
                        const room = this.room;
                        this._piles = global.FlagDir.filter(global.FLAG_COLOR.command.drop, room.getPositionAt(25, 25), true)
                        .map(flagInformation => {
                            let flag = Game.flags[flagInformation.name],
                                piles = room.lookForAt(LOOK_ENERGY, flag.pos.x, flag.pos.y);
                            return piles.length && piles[0] || flag;
                        });
                    }
                    return this._piles;
                }
            },
            'observer': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._observer) && this.room.memory.observer) {
                        this._observer = Game.getObjectById(this.room.memory.observer.id);
                    }
                    return this._observer;
                }
            },
            'nuker': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._nuker)) {
                        if (this.room.memory.nukers && this.room.memory.nukers.length > 0) {
                            this._nuker = Game.getObjectById(this.room.memory.nukers[0].id);
                        }
                    }
                    return this._nuker;
                }
            },
            'nukers': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._nukers)) {
                        this._nukers = new Room.Nuker(this.room);
                    }
                    return this._nukers;
                }
            },
            'powerSpawn': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._powerSpawn)) {
                        if (this.room.memory.powerSpawns && this.room.memory.powerSpawns.length > 0) {
                            this._powerSpawn = Game.getObjectById(this.room.memory.powerSpawns[0].id);
                        }
                    }
                    return this._powerSpawn;
                }
            },
            'powerSpawns': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._powerSpawns)) {
                        this._powerSpawns = new Room.PowerSpawn(this.room);
                    }
                    return this._powerSpawns;
                }
            },
            'extensions': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this.room.memory.extensions)) {
                        this.room.saveExtensions();
                    }
                    if (_.isUndefined(this._extensions)) {
                        this._extensions = _.map(this.room.memory.extensions, e => Game.getObjectById(e));
                    }
                    return this._extensions;
                }
            },
            'spawns': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._spawns)) {
                        this._spawns = [];
                        let addSpawn = id => {
                            global.addById(this._spawns, id);
                        };
                        _.forEach(this.room.memory.spawns, addSpawn);
                    }
                    return this._spawns;
                }
            }
        });
    };

    Object.defineProperties(Room.prototype, {
        'flags': {
            configurable: true,
            get() {
                return global.Util.get(this, '_flags', _.filter(global.FlagDir.list, {roomName: this.name}));
            }
        },
        'structures': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._structures)) {
                    this._structures = new Structures(this);
                }
                return this._structures;
            }
        },
        'isCriticallyFortifyable': {
            configurable: true,
            get: function () {
                return _.some(this.structures.fortifyable, 'isCriticallyFortifyable');
            }
        },
        'relativeEnergyAvailable': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._relativeEnergyAvailable)) {
                    this._relativeEnergyAvailable = this.energyCapacityAvailable > 0 ? this.energyAvailable / this.energyCapacityAvailable : 0;
                }
                return this._relativeEnergyAvailable;
            }
        },
        'relativeRemainingEnergyAvailable': {
            configurable: true,
            get: function () {
                return this.energyCapacityAvailable > 0 ? this.remainingEnergyAvailable / this.energyCapacityAvailable : 0;
            }
        },
        'remainingEnergyAvailable': {
            configurable: true,
            get: function () {
                return this.energyAvailable - this.reservedSpawnEnergy;
            }
        },
        'reservedSpawnEnergy': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._reservedSpawnEnergy)) {
                    this._reservedSpawnEnergy = 0;
                }
                return this._reservedSpawnEnergy;
            },
            set: function (value) {
                this._reservedSpawnEnergy = value;
            }
        },
        'creeps': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._creeps)) {
                    this._creeps = this.find(FIND_MY_CREEPS);
                }
                return this._creeps;
            }
        },
        'allCreeps': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._allCreeps)) {
                    this._allCreeps = this.find(FIND_CREEPS);
                }
                return this._allCreeps;
            }
        },
        'immobileCreeps': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._immobileCreeps)) {
                    this._immobileCreeps = _.filter(this.creeps, c => {
                        const s = c.data && c.data.determinatedSpot;
                        return s && c.pos.isEqualTo(c.room.getPositionAt(s.x, s.y));
                    });
                }
                return this._immobileCreeps;
            }
        },
        'situation': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._situation)) {
                    this._situation = {
                        noEnergy: this.sourceEnergyAvailable === 0,
                        invasion: this.hostiles.length > 0 && (!this.controller || !this.controller.safeMode)
                    }
                }
                return this._situation;
            }
        },
        'adjacentRooms': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.adjacentRooms)) {
                    this.memory.adjacentRooms = Room.adjacentRooms(this.name);
                }
                return this.memory.adjacentRooms;
            }
        },
        'adjacentAccessibleRooms': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.adjacentAccessibleRooms)) {
                    this.memory.adjacentAccessibleRooms = Room.adjacentAccessibleRooms(this.name);
                }
                return this.memory.adjacentAccessibleRooms;
            }
        },
        'privateerMaxWeight': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._privateerMaxWeight)) {
                    this._privateerMaxWeight = 0;
                    if (!this.situation.invasion && !this.conserveForDefense) {
                        let base = this.controller.level * 1000;
                        let that = this;
                        let adjacent, ownNeighbor, room, mult;

                        let flagEntries = FlagDir.filter(FLAG_COLOR.invade.exploit);
                        let countOwn = roomName => {
                            if (roomName == that.name) return;
                            if (Room.isMine(roomName)) ownNeighbor++;
                        };
                        let calcWeight = flagEntry => {
                            if (!this.adjacentAccessibleRooms.includes(flagEntry.roomName)) return;
                            room = Game.rooms[flagEntry.roomName];
                            if (room) {
                                adjacent = room.adjacentAccessibleRooms;
                                mult = room.sources.length;
                            } else {
                                adjacent = Room.adjacentAccessibleRooms(flagEntry.roomName);
                                mult = 1;
                            }
                            ownNeighbor = 1;
                            adjacent.forEach(countOwn);
                            that._privateerMaxWeight += (mult * base / ownNeighbor);
                        };
                        flagEntries.forEach(calcWeight);
                    }
                };
                return this._privateerMaxWeight;
            }
        },
        'claimerMaxWeight': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._claimerMaxWeight)) {
                    this._claimerMaxWeight = 0;
                    let base = 1250;
                    let maxRange = 2;
                    let that = this;
                    let distance, reserved, flag;
                    let rcl = this.controller.level;

                    let flagEntries = FlagDir.filter([FLAG_COLOR.claim, FLAG_COLOR.claim.reserve, FLAG_COLOR.invade.exploit]);
                    let calcWeight = flagEntry => {
                        // don't spawn claimer for reservation at RCL < 4 (claimer not big enough)
                        if (rcl > 3 || (flagEntry.color == FLAG_COLOR.claim.color && flagEntry.secondaryColor == FLAG_COLOR.claim.secondaryColor)) {
                            distance = Room.roomDistance(that.name, flagEntry.roomName);
                            if (distance > maxRange)
                                return;
                            flag = Game.flags[flagEntry.name];
                            if (flag.room && flag.room.controller && flag.room.controller.reservation && flag.room.controller.reservation.ticksToEnd > 2500)
                                return;

                            reserved = flag.targetOf && flag.targetOf ? _.sum(flag.targetOf.map(t => t.creepType == 'claimer' ? t.weight : 0)) : 0;
                            that._claimerMaxWeight += (base - reserved);
                        };
                    };
                    flagEntries.forEach(calcWeight);
                };
                return this._claimerMaxWeight;
            }
        },
        'structureMatrix': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._structureMatrix)) {
                    const cachedMatrix = Room.getCachedStructureMatrix(this.name);
                    if (cachedMatrix) {
                        this._structureMatrix = cachedMatrix;
                    } else {
                        if (global.DEBUG)
                            global.logSystem(this.name, 'Calculating cost matrix');
                        const costMatrix = new PathFinder.CostMatrix;
                        let setCosts = structure => {
                            const site = structure instanceof ConstructionSite;
                            // don't walk on allied construction sites.
                            if (site && !structure.my && Task.reputation.allyOwner(structure)) return costMatrix.set(structure.pos.x, structure.pos.y, 0xFF);
                            if (structure.structureType === STRUCTURE_ROAD) {
                                if (!site || USE_UNBUILT_ROADS)
                                    return costMatrix.set(structure.pos.x, structure.pos.y, 1);
                            } else if (structure.structureType === STRUCTURE_PORTAL) {
                                return costMatrix.set(structure.pos.x, structure.pos.y, 0xFF); // only take final step onto portals
                            } else if (OBSTACLE_OBJECT_TYPES.includes(structure.structureType)) {
                                if (!site || Task.reputation.allyOwner(structure)) // don't set for hostile construction sites
                                    return costMatrix.set(structure.pos.x, structure.pos.y, 0xFF);
                            } else if (structure.structureType === STRUCTURE_RAMPART && !structure.my && !structure.isPublic) {
                                if (!site || Task.reputation.allyOwner(structure)) // don't set for hostile construction sites
                                    return costMatrix.set(structure.pos.x, structure.pos.y, 0xFF);
                            }
                        };
                        this.structures.all.forEach(setCosts);
                        this.constructionSites.forEach(setCosts);
                        this.immobileCreeps.forEach(c => costMatrix.set(c.pos.x, c.pos.y, 0xFF));
                        const prevTime = _.get(Room.pathfinderCache, [this.name, 'updated']);
                        Room.pathfinderCache[this.name] = {
                            costMatrix: costMatrix,
                            updated: Game.time,
                            version: Room.COSTMATRIX_CACHE_VERSION
                        };
                        Room.pathfinderCacheDirty = true;
                        if (global.DEBUG && global.TRACE)
                            global.trace('PathFinder', {roomName: this.name, prevTime, structures: this.structures.all.length, PathFinder: 'CostMatrix'}, 'updated costmatrix');
                        this._structureMatrix = costMatrix;
                    }
                }
                return this._structureMatrix;
            }
        },
        'avoidSKMatrix': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._avoidSKMatrix)) {
                    const SKCreeps = this.hostiles.filter(c => c.owner.username === 'Source Keeper');
                    this._avoidSKMatrix = this.getAvoidMatrix({'Source Keeper': SKCreeps});
                }
                return this._avoidSKMatrix;
            }
        },
        'my': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._my)) {
                    this._my = this.controller && this.controller.my;
                }
                return this._my;
            }
        },
        'myReservation': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._myReservation)) {
                    this._myReservation = this.reservation === global.ME;
                }
                return this._myReservation;
            }
        },
        'reserved': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._reserved)) {
                    if (this.controller) {
                        const myName = _.find(Game.spawns).owner.username;
                        this._reserved = this.controller.my || (this.controller.reservation
                            && this.controller.reservation.username === myName);
                    } else {
                        this._reserved = false;
                    }
                }
                return this._reserved;
            }
        },
        'owner': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._owner)) {
                    if (this.controller && this.controller.owner) {
                        this._owner = this.controller.owner.username;
                    } else {
                        this._owner = false;
                    }
                }
                return this._owner;
            }
        },
        'reservation': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._reservation)) {
                    if (this.controller && this.controller.reservation) {
                        this._reservation = this.controller.reservation.username;
                    } else {
                        this._reservation = false;
                    }
                }
                return this._reservation;
            }
        },
        'ally': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._ally)) {
                    if (this.reserved) {
                        this._ally = true;
                    } else if (this.controller) {
                        this._ally = Task.reputation.isAlly(this.owner) || Task.reputation.isAlly(this.reservation);
                    } else {
                        this._ally = false;
                    }
                }
                return this._ally;
            }
        },
        'pavementArt': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.pavementArt)) {
                    this.memory.pavementArt = [];
                }
                return this.memory.pavementArt;
            }
        },
        'collapsed': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._collapsed)) {
                    // only if owned
                    if (!this.my) {
                        this._collapsed = false;
                        return;
                    }
                    // no creeps ? collapsed!
                    if (!this.population) {
                        this._collapsed = true;
                        return;
                    }
                    // is collapsed if workers + haulers + pioneers in room = 0
                    let workers = this.population.typeCount['worker'] ? this.population.typeCount['worker'] : 0;
                    let haulers = this.population.typeCount['hauler'] ? this.population.typeCount['hauler'] : 0;
                    let pioneers = this.population.typeCount['pioneer'] ? this.population.typeCount['pioneer'] : 0;
                    this._collapsed = (workers + haulers + pioneers) === 0;
                }
                return this._collapsed;
            }
        },
        'RCL': {
            configurable: true,
            get() {
                if (!this.controller) return;
                return Util.get(this.memory, 'RCL', this.controller.level);
            }
        },
        'skip': {
            configurable: true,
            get() {
                return global.Util.get(this, '_skip', !!global.FlagDir.find(global.FLAG_COLOR.command.skipRoom, this));
            }
        },
        'nuked': {
            configurable: true,
            get: function () {
                if (!this._nuked)
                    this._nuked = this.find(FIND_NUKES);
                if (this._nuked.length > 0)
                    return this._nuked;
                else
                    return false;
            }
        },
        // from room.spawn
        'spawnQueueHigh': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.spawnQueueHigh)) {
                    this.memory.spawnQueueHigh = [];
                }
                return this.memory.spawnQueueHigh;
            }
        },
        'spawnQueueMedium': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.spawnQueueMedium)) {
                    this.memory.spawnQueueMedium = [];
                }
                return this.memory.spawnQueueMedium;
            }
        },
        'spawnQueueLow': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.spawnQueueLow)) {
                    this.memory.spawnQueueLow = [];
                }
                return this.memory.spawnQueueLow;
            }
        },
        // from room.resources
        'resourcesStorage': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesStorage)) {

                    this._resourcesStorage = {};

                    if (!_.isUndefined(this.storage)) {
                        Object.keys(this.storage.store).forEach(content => {
                            if (_.isUndefined(this._resourcesStorage[content]))
                                this._resourcesStorage[content] = this.storage.store[content];
                        });
                    }
                }
                return this._resourcesStorage;
            }
        },
        'resourcesTerminal': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesTerminal)) {

                    this._resourcesTerminal = {};

                    if (!_.isUndefined(this.terminal)) {
                        Object.keys(this.terminal.store).forEach(content => {
                            if (_.isUndefined(this._resourcesTerminal[content]))
                                this._resourcesTerminal[content] = this.terminal.store[content];
                        });
                    }

                }
                return this._resourcesTerminal;
            }
        },
        'resourcesLabs': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesLabs)) {

                    this._resourcesLabs = {};
                    let data = this.memory.resources;

                    if (!_.isUndefined(data) && !_.isUndefined(data.lab)) {

                        for (let lab of data.lab) {
                            if (lab.reactionState !== 'Storage') {
                                let labStructure = Game.getObjectById(lab.id),
                                    mineralType = labStructure.mineralType,
                                    mineralAmount = labStructure.mineralAmount;

                                if (!_.isUndefined(mineralType)) {
                                    if (_.isUndefined(this._resourcesLabs[mineralType]))
                                        this._resourcesLabs[mineralType] = mineralAmount;
                                    else
                                        this._resourcesLabs[mineralType] += mineralAmount;
                                }
                            }
                        }
                    }
                }
                return this._resourcesLabs;
            }
        },
        'resourcesCreeps': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesCreeps)) {

                    this._resourcesCreeps = {};

                    for (let creep of this.creeps) {
                        Object.keys(creep.carry).forEach(content => {
                            if (_.isUndefined(this._resourcesCreeps[content]))
                                this._resourcesCreeps[content] = creep.carry[content];
                            else
                                this._resourcesCreeps[content] += creep.carry[content];
                        });
                    }
                }
                return this._resourcesCreeps;
            }
        },
        'resourcesOffers': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesOffers)) {

                    this._resourcesOffers = {};
                    let data = this.memory.resources;

                    if (!_.isUndefined(data) && !_.isUndefined(data.offers))
                        this._resourcesOffers = global.sumCompoundType(data.offers);
                }
                return this._resourcesOffers;
            }
        },
        'resourcesOrders': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesOrders)) {

                    this._resourcesOrders = {};
                    let data = this.memory.resources;

                    if (!_.isUndefined(data) && !_.isUndefined(data.orders))
                        this._resourcesOrders = global.sumCompoundType(data.orders);
                }
                return this._resourcesOrders;
            }
        },
        'resourcesReactions': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesReactions)) {

                    this._resourcesReactions = {};
                    let data = this.memory.resources;

                    if (!_.isUndefined(data) && !_.isUndefined(data.reactions) && !_.isUndefined(data.reactions.orders) && data.reactions.orders.length === 1) {

                        let reaction = data.reactions,
                            reactionOrders = reaction.orders[0];

                        let compound = reactionOrders.type,
                            amount = reactionOrders.amount,
                            ingredientA = (global.LAB_REACTIONS[compound][0]),
                            ingredientB = (global.LAB_REACTIONS[compound][1]),
                            labSeedA = Game.getObjectById(reaction.seed_a),
                            labSeedB = Game.getObjectById(reaction.seed_b),
                            mineralAmountA = labSeedA.mineralAmount,
                            mineralAmountB = labSeedB.mineralAmount;

                        this._resourcesReactions[ingredientA] = amount - mineralAmountA;
                        this._resourcesReactions[ingredientB] = amount - mineralAmountB;

                    }
                }
                return this._resourcesReactions;
            }
        },
        'resourcesAll': {
            configurable: true,
            get() {
                if (_.isUndefined(this._resourcesAll)) {

                    this._resourcesAll = {};

                    if (!_.isUndefined(this.storage)) {
                        Object.keys(this.storage.store).forEach(content => {
                            if (_.isUndefined(this._resourcesAll[content]))
                                this._resourcesAll[content] = this.storedMinerals(content);
                        });
                    }
                    if (!_.isUndefined(this.terminal)) {
                        Object.keys(this.terminal.store).forEach(content => {
                            if (_.isUndefined(this._resourcesAll[content]))
                                this._resourcesAll[content] = this.storedMinerals(content);
                        });
                    }
                }
                return this._resourcesAll;
            }
        },
        'droppedResources': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._droppedResources)) {
                    this._droppedResources = this.find(FIND_DROPPED_RESOURCES);
                }
                return this._droppedResources;
            }
        },
        'minerals': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._minerals)) {
                    this._minerals = [];
                    let add = id => {
                        addById(this._minerals, id);
                    };
                    _.forEach(this.memory.minerals, add);
                }
                return this._minerals;
            }
        },
        'mineralType': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.mineralType)) {
                    let minerals = this.find(FIND_MINERALS);
                    if (minerals && minerals.length > 0)
                        this.memory.mineralType = minerals[0].mineralType;
                    else this.memory.mineralType = '';
                }
                return this.memory.mineralType;
            }
        },
        'sources': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.sources) || this.name == 'sim') {
                    this._sources = this.find(FIND_SOURCES);
                    if (this._sources.length > 0) {
                        this.memory.sources = this._sources.map(s => s.id);
                    } else this.memory.sources = [];
                }
                if (_.isUndefined(this._sources)) {
                    this._sources = [];
                    let addSource = id => {
                        global.addById(this._sources, id);
                    };
                    this.memory.sources.forEach(addSource);
                }
                return this._sources;
            }
        },
        'sourceAccessibleFields': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.sourceAccessibleFields)) {
                    let sourceAccessibleFields = 0;
                    let sources = this.sources;
                    var countAccess = source => sourceAccessibleFields += source.accessibleFields;
                    _.forEach(sources, countAccess);
                    this.memory.sourceAccessibleFields = sourceAccessibleFields;
                }
                return this.memory.sourceAccessibleFields;
            }
        },
        'sourceEnergyAvailable': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._sourceEnergyAvailable)) {
                    this._sourceEnergyAvailable = 0;
                    var countEnergy = source => (this._sourceEnergyAvailable += source.energy);
                    _.forEach(this.sources, countEnergy);
                }
                return this._sourceEnergyAvailable;
            }
        },
        'ticksToNextRegeneration': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._ticksToNextRegeneration)) {
                    this._ticksToNextRegeneration = _(this.sources).map('ticksToRegeneration').min() || 0;
                }
                return this._ticksToNextRegeneration;
            }
        },
        //from room.defense
        'combatCreeps': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._combatCreeps)) {
                    this._combatCreeps = this.creeps.filter(c => ['melee','ranger','healer', 'warrior'].includes(c.data.creepType));
                }
                return this._combatCreeps;
            }
        },
        'casualties': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._casualties)) {
                    var isInjured = creep => creep.hits < creep.hitsMax &&
                        (creep.towers === undefined || creep.towers.length == 0);
                    this._casualties = _.sortBy(_.filter(this.creeps, isInjured), 'hits');
                }
                return this._casualties;
            }
        },
        'conserveForDefense': {
            configurable: true,
            get: function () {
                return (this.my && this.storage && this.storage.charge < 0);
            }
        },
        'defenseLevel': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._defenseLevel)) {
                    this._defenseLevel = {
                        towers: 0,
                        creeps: 0,
                        sum: 0
                    };
                    let evaluate = creep => {
                        this._defenseLevel.creeps += creep.threat;
                    };
                    this.combatCreeps.forEach(evaluate);
                    this._defenseLevel.towers = this.structures.towers.length;
                    this._defenseLevel.sum = this._defenseLevel.creeps + (this._defenseLevel.towers * Creep.partThreat.tower);
                }
                return this._defenseLevel;
            }
        },
        'hostile': {
            configurable: true,
            get: function () {
                return this.memory.hostile;
            }
        },
        'hostiles': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._hostiles)) {
                    this._hostiles = this.find(FIND_HOSTILE_CREEPS, { filter : Task.reputation.hostileOwner });
                }
                return this._hostiles;
            }
        },
        'hostileIds': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._hostileIds)) {
                    this._hostileIds = _.map(this.hostiles, 'id');
                }
                return this._hostileIds;
            }
        },
        'hostileThreatLevel': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._hostileThreatLevel)) {
                    // TODO: add towers when in foreign room
                    this._hostileThreatLevel = 0;
                    let evaluateBody = creep => {
                        this._hostileThreatLevel += creep.threat;
                    };
                    this.hostiles.forEach(evaluateBody);
                }
                return this._hostileThreatLevel;
            }
        },
        // from room.construction
        'constructionSites': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._constructionSites)) {
                    this._constructionSites = this.find(FIND_CONSTRUCTION_SITES);
                }
                return this._constructionSites;
            }
        },
        'myConstructionSites': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this._myConstructionSites)) {
                    this._myConstructionSites = this.find(FIND_MY_CONSTRUCTION_SITES);
                }
                return this._myConstructionSites;
            }
        },
        'roadConstructionTrace': {
            configurable: true,
            get: function () {
                if (_.isUndefined(this.memory.roadConstructionTrace)) {
                    this.memory.roadConstructionTrace = {};
                }
                return this.memory.roadConstructionTrace;
            }
        },
        // from flagDir
        'newFlag': {
            configurable: true,
            /**
             * Create a new flag
             * @param {Object|string} flagColour - An object with color and secondaryColor properties, or a string path for a FLAG_COLOR
             * @param {RoomPosition} [pos] - The position to place the flag. Will assume (25, 25) if left undefined
             * @param {string} [name] - Optional name for the flag
             * @returns {string|Number} The name of the flag or an error code.
             */
            value: function (flagColour, pos, name) {
                if (!pos) pos = this.getPositionAt(25, 25);
                return pos.newFlag(flagColour, name);
            }
        },

    });

};

mod.register = () => {
    /*
    // run register in each of our submodules
    for (let key of Object.keys(Room._ext))
        if (Room._ext[key].register)
            Room._ext[key].register();

*/

    Room.costMatrixInvalid.on(room => mod.rebuildCostMatrix(room.name || room));
    Room.RCLChange.on(room => room.structures.all.filter(s => ![STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_RAMPART].includes(s.structureType)).forEach(s => {
        if (!s.isActive()) _.set(room.memory, ['structures', s.id, 'active'], false);
    }));
};
mod.flush = () => {
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
mod.totalSitesChanged = () => {
    let numSites = _.size(Game.constructionSites),
        oldSites = Memory.rooms.myTotalSites || 0;

    if (numSites > 0)
        Memory.rooms.myTotalSites = numSites;
    else
        delete Memory.rooms.myTotalSites;

    return oldSites && oldSites !== numSites;
};
mod.totalStructuresChanged = () => {
    let numStructures = _.size(Game.structures),
        oldStructures = Memory.rooms.myTotalStructures || 0;
    if (numStructures > 0)
        Memory.rooms.myTotalStructures = numStructures;
    else delete
        Memory.rooms.myTotalStructures;

    return oldStructures && oldStructures !== numStructures;
};
mod.needMemoryResync = room => {
    if (_.isUndefined(room.memory.initialized)) {
        room.memory.initialized = Game.time;
        return true;
    }
    return Game.time % global.MEMORY_RESYNC_INTERVAL === 0 || room.name === 'sim';
};
mod.analyze = () => {
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
            Game.notify(`Error in room.js (Room.prototype.loop) for "${room.name}" : ${err.stack}` ? `${err}<br/>${err.stack}` : err);
            console.log(global.dye(global.CRAYON.error, `Error in room.js (Room.prototype.loop) for "${room.name}": <br/>${err.stack || err.toString()}<br/>${err.stack}`));
        }
    };
    _.forEach(Game.rooms, r => {
        if (r.skip)
            return;
        getEnvironment(r);
        p.checkCPU(r.name, global.PROFILING.ANALYZE_LIMIT / 5);
    });
};
mod.execute = () => {
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
                    let p2 = global.Util.startProfiling(`${roomName}execute`, {enabled: global.PROFILING.ROOMS});
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
        p.checkCPU(`${roomName}.run`, 1);
        if (Game.time % global.MEMORY_RESYNC_INTERVAL === 0 && !Game.rooms[roomName] && typeof Memory.rooms[roomName].hostile !== 'boolean') {
            // clean up stale room memory for rooms no longer in use, but preserve manually set 'hostile' entries
            delete Memory.rooms[roomName];
        }
    });
};
mod.cleanup = () => {
    // run cleanup in each of our submodules
    for (let key of Object.keys(Room._ext)) {
        if (Room._ext[key].cleanup) Room._ext[key].cleanup();
    }
    // flush changes to the pathfinderCache but wait until load
    if (!_.isUndefined(Memory.pathfinder)) {
        global.OCSMemory.saveSegment(global.MEM_SEGMENTS.COSTMATRIX_CACHE, Memory.pathfinder);
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
                        global.CompressedMatrix.serialize(entry.costMatrix) : entry.costMatrix.serialize()),
                    updated: entry.updated,
                    version: entry.version
                };
                // only set memory when we need to
                if (entry.stale) encodedCache[key].stale = true;
            }
        }
        global.OCSMemory.saveSegment(global.MEM_SEGMENTS.COSTMATRIX_CACHE, encodedCache);
        Room.pathfinderCacheDirty = false;
    }
};
mod.routeCallback = (origin, destination, options) => {
    if (_.isUndefined(origin) || _.isUndefined(destination))
        global.logError('Room.routeCallback', `both origin and destination must be defined - origin:${origin} destination:${destination}`);
    return roomName => {
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
        if (isMyOrNeutralRoom || roomName === origin || roomName === destination)
            return 1;
        else if (isHighway)
            return 3;
        else if (Game.map.isRoomAvailable(roomName))
            return (options.checkOwner || options.preferHighway) ? 11 : 1;
        return Number.POSITIVE_INFINITY;
    };
};
mod.getCostMatrix = roomName => {
    let room = Game.rooms[roomName];
    if (!room)
        return;
    return room.costMatrix;
};
mod.isMine = roomName => {
    let room = Game.rooms[roomName];
    return (room && room.my);
};
mod.calcCardinalDirection = roomName => {
    const parsed = /^([WE])[0-9]+([NS])[0-9]+$/.exec(roomName);
    return [parsed[1], parsed[2]];
};
mod.calcGlobalCoordinates = (roomName, callBack) => {
    if (!callBack) return null;
    const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
    let x = +parsed[1],
        y = +parsed[2];

    return callBack(x, y);
};
mod.calcCoordinates = (roomName, callBack) => {
    if (!callBack) return null;
    return Room.calcGlobalCoordinates(roomName, (x, y) => {
        return callBack(x % 10, y % 10);
    });
};
mod.isCenterRoom = roomName => Room.calcCoordinates(roomName, (x, y) => {
    return x === 5 && y === 5;
});
mod.isCenterNineRoom = roomName => {
    if (roomName === 'sim')
        return false;

    return Room.calcCoordinates(roomName, (x,y) => {
            return x > 3 && x < 7 && y > 3 && y < 7;
        });
};
mod.isControllerRoom = roomName => Room.calcCoordinates(roomName, (x, y) => {
    return x !== 0 && y !== 0 && (x < 4 || x > 6 || y < 4 || y > 6);
});
mod.isSKRoom = roomName => {
    if (roomName === 'sim')
        return false;
    return Room.calcCoordinates(roomName, (x,y) => {
        return x > 3 && x < 7 && y > 3 && y < 7 && (x !== 5 || y !== 5);
    });
};
mod.isHighwayRoom = roomName => Room.calcCoordinates(roomName, (x, y) => {
    return x === 0 || y === 0;
});
mod.adjacentRooms = roomName => {
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
mod.adjacentAccessibleRooms = (roomName, diagonal = true) => {
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
mod.roomDistance = (roomName1, roomName2, diagonal, continuous) => {
    if (diagonal) return Game.map.getRoomLinearDistance(roomName1, roomName2, continuous);
    if (roomName1 === roomName2) return 0;
    let posA = roomName1.split(/([NESW])/);
    let posB = roomName2.split(/([NESW])/);
    let xDif = posA[1] === posB[1] ? Math.abs(posA[2] - posB[2]) : posA[2] + posB[2] + 1;
    let yDif = posA[3] === posB[3] ? Math.abs(posA[4] - posB[4]) : posA[4] + posB[4] + 1;
    //if( diagonal ) return Math.max(xDif, yDif); // count diagonal as 1
    return xDif + yDif; // count diagonal as 2
};
mod.rebuildCostMatrix = roomName => {
    if (global.DEBUG)
        global.logSystem(roomName, 'Invalidating costmatrix to force a rebuild when we have vision.');
    _.set(Room, ['pathfinderCache', roomName, 'stale'], true);
    _.set(Room, ['pathfinderCache', roomName, 'updated'], Game.time);
    Room.pathfinderCacheDirty = true;
};
mod.loadCostMatrixCache = cache => {
    let count = 0;
    for (const key in cache) {
        if (!mod.pathfinderCache[key] || mod.pathfinderCache[key].updated < cache[key].updated) {
            count++;
            mod.pathfinderCache[key] = cache[key];
        }
    }
    if (global.DEBUG && count > 0)
        global.logSystem('RawMemory', `loading pathfinder cache.. updated ${count} stale entries.`);
    mod.pathfinderCacheLoaded = true;
};
mod.getCachedStructureMatrix = roomName => {
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
            let costMatrix = global.COMPRESS_COST_MATRICES ? global.CompressedMatrix.deserialize(cache.serializedMatrix) : PathFinder.CostMatrix.deserialize(cache.serializedMatrix);
            cache.costMatrix = costMatrix;
            return costMatrix;
        } else {
            global.logError('Room.getCachedStructureMatrix', `Cached costmatrix for ${roomName} is invalid ${cache}`);
            delete Room.pathfinderCache[roomName];
        }
    }
};
mod.getStructureMatrix = (roomName, options) => {
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
mod.validFields = (roomName, minX, maxX, minY, maxY, checkWalkable = false, where = null) => {
    let room = Game.rooms[roomName],
        look = checkWalkable ? room.lookAtArea(minY, minX, maxY, maxX) : null,
        fields = [];

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
mod.fieldsInRange = args => {
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
mod.shouldRepair = (room, structure) => (
    // is not at 100%
    structure.hits < structure.hitsMax &&
    // not owned room or hits below RCL repair limit
    (!room.my || structure.hits < global.MAX_REPAIR_LIMIT[room.controller.level] || structure.hits < (global.LIMIT_URGENT_REPAIRING + (2 * global.DECAY_AMOUNT[structure.structureType] || 0))) &&
    // not decayable or below threshold
    (!global.DECAYABLES.includes(structure.structureType) || (structure.hitsMax - structure.hits) > global.GAP_REPAIR_DECAYABLE) &&
    // not pavement art
    (Memory.pavementArt[room.name] === undefined || Memory.pavementArt[room.name].indexOf(`x${structure.pos.x}y${structure.pos.y}x`) < 0) &&
    // not flagged for removal
    (!global.FlagDir.list.some(f => f.roomName === structure.pos.roomName && f.color === COLOR_ORANGE && f.x === structure.pos.x && f.y === structure.pos.y))
);

// from room.spawn

mod.bestSpawnRoomFor = targetRoomName => {
    let range = room => room.my ? global.Util.routeRange(room.name, targetRoomName) : Infinity;
    return _.min(Game.rooms, range);
};
// find a room to spawn
// params: { targetRoom, minRCL = 0, maxRange = Infinity, minEnergyAvailable = 0, minEnergyCapacity = 0, callBack = null, allowTargetRoom = false, rangeRclRatio = 3, rangeQueueRatio = 51 }
// requiredParams: targetRoom
mod.findSpawnRoom = params => {
    if (!params || !params.targetRoom) return null;
    // filter validRooms
    let isValidRoom = room => (
        room.my &&
        (params.maxRange === undefined || global.Util.routeRange(room.name, params.targetRoom) <= params.maxRange) &&
        (params.minEnergyCapacity === undefined || params.minEnergyCapacity <= room.energyCapacityAvailable) &&
        (params.minEnergyAvailable === undefined || params.minEnergyAvailable <= room.energyAvailable) &&
        (room.name !== params.targetRoom || params.allowTargetRoom === true) &&
        (params.minRCL === undefined || room.controller.level >= params.minRCL) &&
        (params.callBack === undefined || params.callBack(room))
    );
    let validRooms = _.filter(Game.rooms, isValidRoom);
    if (validRooms.length === 0) return null;
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

mod.roomLayout = flag => {
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



