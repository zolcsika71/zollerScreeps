"use strict";

let mod = {};
module.exports = mod;
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
                                    structure.hits < MAX_FORTIFY_LIMIT[that.room.controller.level] &&
                                    (structure.structureType != STRUCTURE_CONTAINER || structure.hits < MAX_FORTIFY_CONTAINER) &&
                                    (!DECAYABLES.includes(structure.structureType) || (structure.hitsMax - structure.hits) > GAP_REPAIR_DECAYABLE * 3) &&
                                    (Memory.pavementArt[that.room.name] === undefined || Memory.pavementArt[that.room.name].indexOf('x' + structure.pos.x + 'y' + structure.pos.y + 'x') < 0) &&
                                    (!FlagDir.list.some(f => f.roomName == structure.pos.roomName && f.color == COLOR_ORANGE && f.x == structure.pos.x && f.y == structure.pos.y))
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
                        var that = this;
                        var factor = that.room.situation.invasion ? 1 : 0.82;
                        var fuelable = target => (target.energy < (target.energyCapacity * factor));
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
                        this._piles = FlagDir.filter(FLAG_COLOR.command.drop, room.getPositionAt(25, 25), true)
                            .map(function (flagInformation) {
                                const flag = Game.flags[flagInformation.name];
                                const piles = room.lookForAt(LOOK_ENERGY, flag.pos.x, flag.pos.y);
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
                        var addSpawn = id => {
                            addById(this._spawns, id);
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

    // structure constructors
    Room.Links = function (room) {
        this.room = room;

        Object.defineProperties(this, {
            'all': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._all)) {
                        this._all = [];
                        let add = entry => {
                            let o = Game.getObjectById(entry.id);
                            if (o) {
                                _.assign(o, entry);
                                this._all.push(o);
                            }
                        };
                        _.forEach(this.room.memory.links, add);
                    }
                    return this._all;
                }
            },
            'controller': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._controller)) {
                        let byType = c => c.controller === true;
                        this._controller = this.all.filter(byType);
                    }
                    return this._controller;
                }
            },
            'storage': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._storage)) {
                        let byType = l => l.storage == true;
                        this._storage = this.all.filter(byType);
                    }
                    return this._storage;
                }
            },
            'in': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._in)) {
                        let byType = l => l.storage == false && l.controller == false;
                        this._in = _.filter(this.all, byType);
                    }
                    return this._in;
                }
            },
            'privateers': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._privateers)) {
                        let byType = l => l.storage == false && l.controller == false && l.source == false && l.energy < l.energyCapacity * 0.85;
                        this._privateers = _.filter(this.all, byType);
                    }
                    return this._privateers;
                }
            }
        });
    };
    Room.Containers = function (room) {
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
    Room.Labs = function (room) {
        this.room = room;
        Object.defineProperties(this, {
            'all': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._all)) {
                        this._all = [];
                        let add = entry => {
                            let o = Game.getObjectById(entry.id);
                            if (o) {
                                _.assign(o, entry);
                                this._all.push(o);
                            }
                        };
                        _.forEach(this.room.memory.labs, add);
                    }
                    return this._all;
                }
            },
            'storage': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._storage)) {
                        this._storage = _.filter(room.memory.resources.lab.reactionState, reactionState => {
                            return reactionState === 'Storage';
                        });
                    }
                    return this._storage;
                }
            }
        });
    };
    Room.Nuker = function (room) {
        this.room = room;
        Object.defineProperties(this, {
            'all': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._all)) {
                        this._all = [];
                        let add = entry => {
                            let o = Game.getObjectById(entry.id);
                            if (o) {
                                _.assign(o, entry);
                                this._all.push(o);
                            }
                        };
                        _.forEach(this.room.memory.nukers, add);
                    }
                    return this._all;
                }
            }
        });
    };
    Room.PowerSpawn = function (room) {
        this.room = room;
        Object.defineProperties(this, {
            'all': {
                configurable: true,
                get: function () {
                    if (_.isUndefined(this._all)) {
                        this._all = [];
                        let add = entry => {
                            let o = Game.getObjectById(entry.id);
                            if (o) {
                                _.assign(o, entry);
                                this._all.push(o);
                            }
                        };
                        _.forEach(this.room.memory.powerSpawns, add);
                    }
                    return this._all;
                }
            }
        });
    };

};

