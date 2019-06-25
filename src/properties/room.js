"use strict";

const
    GLOBAL = {
        util: require(`./global.util`)
    },
    ROOT = {
        flagDir: require('./flagDir'),
    };

let mod = {};
module.exports = mod;

mod.extend = function () {

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
                return Util.get(this, '_flags', _.filter(FlagDir.list, {roomName: this.name}));
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
                        noEnergy: this.sourceEnergyAvailable == 0,
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
                        if (global.DEBUG) logSystem(this.name, 'Calculating cost matrix');
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
                        if (global.DEBUG && global.TRACE) trace('PathFinder', {roomName: this.name, prevTime, structures: this.structures.all.length, PathFinder: 'CostMatrix'}, 'updated costmatrix');
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
            get: function (){
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
                return GLOBAL.util.get(this, '_skip', !!global.FlagDir.find(global.FLAG_COLOR.command.skipRoom, this));
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
        }
    });

};

