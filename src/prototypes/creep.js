"use strict";

const
    //_ = require('lodash'),
    strategy = require('./strategy'),
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)

    },
    ROOT = {
        population: require('./population')
    };


let mod = {};
module.exports = mod;
mod.extend = function () {

    Creep.prototype.assignAction = function (action, target) {
        if (typeof action === 'string')
            action = Creep.action[action];
        if (!action || !(action instanceof Creep.Action))
            return;
        return action.assign(this, target);
    };
    Creep.prototype.assignBehaviour = function (behaviour) {
        if (typeof behaviour === 'string')
            behaviour = Creep.behaviour[behaviour];
        if (!behaviour || !(behaviour instanceof Creep.Behaviour))
            return;
        return behaviour.assign(this);
    };

    // to maintain legacy code for now
    Creep.prototype.findGroupMemberByType = function (creepType, flagName) {
        return Creep.prototype.findGroupMemberBy(c => c.creepType === creepType, flagName);
    };

    Creep.prototype.findGroupMemberBy = function (findFunc, flagName) {
        if (_.isUndefined(flagName))
            flagName = this.data.flagName;
        if (!_.isUndefined(findFunc) && flagName) {
            const ret = _(Memory.population).filter({flagName}).find(findFunc);
            return ret ? ret.creepName : null;
        } else {
            GLOBAL.util.logError(`${this.name} - Invalid arguments for Creep.findGroupMemberBy ${flagName} ${findFunc}`);
        }
        return null;
    };
    Creep.prototype.findByType = function (creepType) {

        let creep;
        for (let i in Memory.population) {

            creep = Memory.population[i];
            if (creep.creepType === creepType)
                return i;

        }
    };
    Creep.prototype.getBodyparts = function (type) {
        return _(this.body).filter({type}).value().length;
    };

    // Check if a creep has body parts of a certain type anf if it is still active.
    // Accepts a single part type (like RANGED_ATTACK) or an array of part types.
    // Returns true, if there is at least any one part with a matching type present and active.
    Creep.prototype.hasActiveBodyparts = function (partTypes) {
        return this.hasBodyparts(partTypes, this.body.length - Math.ceil(this.hits * 0.01));
    };

    Creep.prototype.hasBodyparts = function (partTypes, start = 0) {
        const body = this.body,
             limit = body.length;
        if (!Array.isArray(partTypes)) {
            partTypes = [partTypes];
        }
        for (let i = start; i < limit; i++) {
            if (partTypes.includes(body[i].type)) {
                return true;
            }
        }
        return false;
    };
    Creep.prototype.run = function (behaviour) {
        if (!this.spawning) {
            if (!behaviour && this.data && this.data.creepType) {
                behaviour = Creep.behaviour[this.data.creepType];
                if (this.room.skip)
                    return;
                if (Memory.CPU_CRITICAL && !global.CRITICAL_ROLES.includes(this.data.creepType))
                    return;
            }
            const
                total = global.Util.startProfiling('Creep.run', {enabled: global.PROFILING.CREEPS}),
                p = GLOBAL.util.startProfiling(this.name + '.run', {enabled: this.data && this.data.creepType && global.PROFILING.CREEP_TYPE === this.data.creepType});

            if (this.data && !_.contains(['remoteMiner', 'miner', 'upgrader'], this.data.creepType)) {
                this.repairNearby();
                p.checkCPU('repairNearby', global.PROFILING.MIN_THRESHOLD);
                this.buildNearby();
                p.checkCPU('buildNearby', global.PROFILING.MIN_THRESHOLD);
            }
            if (global.DEBUG && global.TRACE)
                GLOBAL.util.trace('Creep', {creepName: this.name, pos: this.pos, Behaviour: behaviour && behaviour.name, Creep: 'run'});
            if (behaviour) {
                behaviour.run(this);
                p.checkCPU('behaviour.run', global.PROFILING.MIN_THRESHOLD);
            } else if (!this.data) {
                if (global.DEBUG && global.TRACE)
                    GLOBAL.util.trace('Creep', {creepName: this.name, pos: this.pos, Creep: 'run'}, 'memory init');
                let type = this.memory.setup;
                let weight = this.memory.cost;
                let home = this.memory.home;
                let spawn = this.memory.mother;
                let breeding = this.memory.breeding;
                if (type && weight && home && spawn && breeding) {
                    //console.log( 'Fixing corrupt creep without population entry: ' + this.name );
                    let entry = ROOT.population.setCreep({
                        creepName: this.name,
                        creepType: type,
                        weight: weight,
                        roomName: this.pos.roomName,
                        homeRoom: home,
                        motherSpawn: spawn,
                        actionName: this.action ? this.action.name : null,
                        targetId: this.target ? this.target.id || this.target.name : null,
                        spawningTime: breeding,
                        flagName: null,
                        body: _.countBy(this.body, 'type')
                    });
                    ROOT.population.countCreep(this.room, entry);
                } else {
                    console.log(GLOBAL.util.dye(global.CRAYON.error, 'Corrupt creep without population entry!! : ' + this.name), GLOBAL.util.stack());
                    // trying to import creep
                    let counts = _.countBy(this.body, 'type');
                    if (counts[WORK] && counts[CARRY]) {
                        let weight = (counts[WORK] * BODYPART_COST[WORK]) + (counts[CARRY] * BODYPART_COST[CARRY]) + (counts[MOVE] * BODYPART_COST[MOVE]);
                        let entry = ROOT.population.setCreep({
                            creepName: this.name,
                            creepType: 'worker',
                            weight: weight,
                            roomName: this.pos.roomName,
                            homeRoom: this.pos.roomName,
                            motherSpawn: null,
                            actionName: null,
                            targetId: null,
                            spawningTime: -1,
                            flagName: null,
                            body: _.countBy(this.body, 'type')
                        });
                        ROOT.population.countCreep(this.room, entry);
                    } else this.suicide();
                    p.checkCPU('!this.data', global.PROFILING.MIN_THRESHOLD);
                }
            }
            if (this.flee) {
                this.fleeMove();
                p.checkCPU('fleeMove', global.PROFILING.MIN_THRESHOLD);
                Creep.behaviour.ranger.heal(this);
                p.checkCPU('heal', global.PROFILING.MIN_THRESHOLD);
                if (global.SAY_ASSIGNMENT)
                    this.say(String.fromCharCode(10133), global.SAY_PUBLIC);

            }
            total.checkCPU(this.name, global.PROFILING.EXECUTE_LIMIT / 3, this.data ? this.data.creepType : 'noType');
        }
        strategy.freeStrategy(this);
    };
    Creep.prototype.leaveBorder = function () {

        function getDirectionPriorities(lastDirection) {

            let dl, dr, dRev,
                result = [];

            if (lastDirection === 0)
                return _.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);

            result.push(lastDirection);

            for (let i = 1; i < 4; i++) {

                dl = lastDirection - i;
                if (dl < 1)
                    dl = dl + 8;
                dr = lastDirection + i;
                if (dr > 8)
                    dr = dr - 8;
                result.push(..._.shuffle([dl, dr]))
            }
            dRev = lastDirection + 4;
            if (dRev > 8)
                dRev = dRev - 8;
            result.push(dRev);
            return result
        }

        let
            directionsFromExit = {
                x: {
                    49: [7, 8, 6],
                    0: [3, 4, 2]
                },
                y: {
                    49: [1, 8, 2],
                    0: [5, 6, 4]
                }
            },
            roomPos,
            allowedDirections;

        if (directionsFromExit.x[this.pos.x])
            allowedDirections = directionsFromExit.x[this.pos.x];
        else if (directionsFromExit.y[this.pos.y])
            allowedDirections = directionsFromExit.y[this.pos.y];

        if (!allowedDirections)
            return false;

        allowedDirections = getDirectionPriorities(allowedDirections[0]);

        for (let direction of allowedDirections) {

            roomPos = this.pos.fromDirection(direction);

            if (roomPos.x > 0 && roomPos.y > 0) {

                let stuff = roomPos.look(),
                    // TODO none of them working :(
                    noObstacle = !_.some(stuff, object => {
                        return object.type === 'creep' || (object.type === 'structure' && OBSTACLE_OBJECT_TYPES.includes(object.structureType)) || (object.type === 'terrain' && object.terrain === 'wall')
                    });

                if (_.findIndex(stuff, p => p.type === 'creep' || (p.type === 'structure' && OBSTACLE_OBJECT_TYPES.includes(p.structureType)) || (p.type === 'terrain' && p.terrain === 'wall')) === -1) {
                    this.move(direction);
                    return direction;
                }
            }
        }
    };
    Creep.prototype.honk = function () {
        if (global.HONK) this.say('\u{26D4}\u{FE0E}', SAY_PUBLIC);
    };
    Creep.prototype.honkEvade = function () {
        if (HONK) this.say('\u{1F500}\u{FE0E}', SAY_PUBLIC);
    };
    Creep.prototype.fleeMove = function () {
        if (global.DEBUG && global.TRACE) GLOBAL.util.trace('Creep', {creepName: this.name, pos: this.pos, Action: 'fleeMove', Creep: 'run'});
        let drop = r => {
            if (this.carry[r] > 0) this.drop(r);
        };
        _.forEach(Object.keys(this.carry), drop);
        if (this.fatigue > 0) return;
        let path;
        if (!this.data.fleePath || this.data.fleePath.length < 2 || this.data.fleePath[0].x != this.pos.x || this.data.fleePath[0].y != this.pos.y || this.data.fleePath[0].roomName != this.pos.roomName) {
            let goals = _.map(this.room.hostiles, function (o) {
                return { pos: o.pos, range: 5 };
            });

            let ret = PathFinder.search(
                this.pos, goals, {
                    flee: true,
                    plainCost: 2,
                    swampCost: 10,
                    maxOps: 500,
                    maxRooms: 2,

                    roomCallback: function (roomName) {
                        let room = Game.rooms[roomName];
                        if (!room) return;
                        return room.creepMatrix;
                    }
                }
            );
            path = ret.path;

            this.data.fleePath = path;
        } else {
            this.data.fleePath.shift();
            path = this.data.fleePath;
        }
        if (path && path.length > 0)
            this.move(this.pos.getDirectionTo(new RoomPosition(path[0].x,path[0].y,path[0].roomName)));
    };
    Creep.prototype.idleMove = function () {
        if (this.fatigue > 0) return;
        // check if on road/structure
        const needToMove = _(this.room.structures.piles).filter('pos', this.pos)
        .concat(this.pos.lookFor(LOOK_STRUCTURES))
        .concat(this.pos.lookFor(LOOK_CONSTRUCTION_SITES))
        .size();
        if (needToMove) {
            if (!this.data.idle || !this.data.idle.path || !this.data.idle.path.length || this.pos.isEqualTo(this.data.idle.lastPos)) {
                const idleFlag = FlagDir.find(FLAG_COLOR.command.idle, this.pos, true, (r, flagEntry) => {
                    const flag = Game.flags[flagEntry.name];
                    const occupied = flag.pos.lookFor(LOOK_CREEPS);
                    if (occupied && occupied.length) {
                        return Infinity;
                    } else {
                        return r;
                    }
                });
                let ret;
                if (idleFlag) {
                    ret = PathFinder.search(
                        this.pos, {pos: idleFlag.pos, range: 0}, {
                            plainCost: 2,
                            swampCost: 10,
                            maxOps: 350,
                            maxRooms: 1,
                            roomCallback: (roomName) => {
                                let room = Game.rooms[roomName];
                                if (!room) return;
                                return room.structureMatrix;
                            }
                        });
                } else {
                    let goals = this.room.structures.all.map(function (o) {
                        return { pos: o.pos, range: 1 };
                    }).concat(this.room.sources.map(function (s) {
                        return { pos: s.pos, range: 2 };
                    })).concat(this.pos.findInRange(FIND_EXIT, 2).map(function (e) {
                        return { pos: e, range: 1 };
                    })).concat(this.room.myConstructionSites.map(function (o) {
                        return { pos: o.pos, range: 1};
                    }));
                    ret = PathFinder.search(
                        this.pos, goals, {
                            flee: true,
                            plainCost: 2,
                            swampCost: 10,
                            maxOps: 350,
                            maxRooms: 1,
                            roomCallback: (roomName) => {
                                let room = Game.rooms[roomName];
                                if (!room) return;
                                return room.structureMatrix;
                            }
                        }
                    );
                }
                this.data.idle = {
                    path: Traveler.serializePath(this.pos, ret.path),
                    lastPos: this.pos
                };
            } else {
                this.data.idle.path = this.data.idle.path.substr(1);
            }
            const next = parseInt(this.data.idle.path[0], 10);
            if (next) {
                this.data.idle.lastPos = this.pos;
                this.move(next);
            }
            if (this.data.idle.path && !this.data.idle.path.length) {
                delete this.data.idle;
            }
        }
    };
    Creep.prototype.repairNearby = function () {
        // only repair in rooms that we own, have reserved, or belong to our allies, also SK rooms and highways.
        if (this.room.controller && this.room.controller.owner && !(this.room.my || this.room.reserved || this.room.ally)) return;
        // if it has energy and a work part, remoteMiners do repairs once the source is exhausted.
        if (this.carry.energy > 0 && this.hasActiveBodyparts(WORK)) {
            const repairRange = this.data && this.data.creepType === 'remoteHauler' ? global.REMOTE_HAULER.DRIVE_BY_REPAIR_RANGE : global.DRIVE_BY_REPAIR_RANGE;
            const repairTarget = _(this.pos.findInRange(FIND_STRUCTURES, repairRange)).find(s => Room.shouldRepair(this.room, s));
            if (repairTarget) {
                if (global.DEBUG && global.TRACE) GLOBAL.util.trace('Creep', {creepName: this.name, Action: 'repairing', Creep: 'repairNearby'}, repairTarget.pos);
                this.repair(repairTarget);
            }
        } else {
            if (global.DEBUG && global.TRACE)
                GLOBAL.util.trace('Creep', {creepName: this.name, pos: this.pos, Action: 'repairing', Creep: 'repairNearby'}, 'not repairing');

        }
    };
    Creep.prototype.buildNearby = function () {
        // enable remote haulers to build their own roads and containers
        if (!global.REMOTE_HAULER.DRIVE_BY_BUILDING || !this.data || this.data.creepType !== 'remoteHauler') return;
        const buildTarget = _(this.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, global.REMOTE_HAULER.DRIVE_BY_BUILD_RANGE))
        .find(s => global.REMOTE_HAULER.DRIVE_BY_BUILD_ALL ||
            (s.structureType === STRUCTURE_CONTAINER ||
                s.structureType === STRUCTURE_ROAD));
        if (buildTarget) {
            if (global.DEBUG && global.TRACE)
                GLOBAL.util.trace('Creep', {creepName: this.name, Action: 'building', Creep: 'buildNearby'}, buildTarget.pos);
            this.build(buildTarget);
        } else {
            if (global.DEBUG && global.TRACE)
                GLOBAL.util.trace('Creep', {creepName: this.name, Action: 'building', Creep: 'buildNearby'}, 'not building');
        }
    };
    Creep.prototype.controllerSign = function () {
        const signMessage = Util.fieldOrFunction(CONTROLLER_SIGN_MESSAGE, this.room);
        if (CONTROLLER_SIGN && (!this.room.controller.sign || this.room.controller.sign.username !== this.owner.username || (CONTROLLER_SIGN_UPDATE && this.room.controller.sign.text !== signMessage))) {
            this.signController(this.room.controller, signMessage);
        }
    };

    // errorData = {errorCode, action, target, ...}
    Creep.prototype.handleError = function (errorData) {
        if (Creep.resolvingError) return;

        this.resolvingError = errorData;
        errorData.preventDefault = function () {
            Creep.resolvingError = null;
        };

        Creep.error.trigger(errorData);

        if (Creep.resolvingError) {
            if (global.DEBUG) logErrorCode(this, errorData.errorCode);
            delete this.data.actionName;
            delete this.data.targetId;
            Creep.resolvingError = null;
        }
    };

    // Explain API extension
    Creep.prototype.explainAgent = function () {
        if (this.action) {
            this.action.showAssignment(this, this.target);
        }
        return `ttl:${this.ticksToLive} pos:${this.pos}`;
    };

    // API
    Creep.prototype.staticCustomStrategy = function (actionName, behaviourName, taskName) {};
    Creep.prototype.customStrategy = function (actionName, behaviourName, taskName) {};

    // Creep.prototype.strategy = function(actionName, behaviourName, taskName)
    strategy.decorateAgent(Creep.prototype,
        {   default: creep => creep.action && creep.action.name,
            selector: actionName => Creep.action[actionName]},
        {   default: creep => creep.data.creepType,
            selector: behaviourName => Creep.behaviour[behaviourName] && Creep.behaviour[behaviourName]},
        {   default: creep => creep.data.destiny && creep.data.destiny.task,
            selector: taskName => Task[taskName] && Task[taskName]
        });



};

