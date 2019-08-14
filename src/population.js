"use strict";

const
    ROOT = {
        flagDir: require('./flagDir')
    };


let mod = {};
module.exports = mod;

mod.getCreep = function (creepName) {
    return Memory.population[creepName];
};
mod.setCreep = function (val) {
    Memory.population[val.creepName] = val;
    return Memory.population[val.creepName];
};
mod.registerCreep = function (creepName, creepType, creepCost, room, spawnName, body, destiny = null) {
    let entry = this.setCreep({
        creepName: creepName,
        creepType: creepType,
        weight: creepCost,
        roomName: room.name,
        homeRoom: room.name,
        motherSpawn: spawnName,
        actionName: null,
        targetId: null,
        spawningTime: 0,
        flagName: null,
        body: _.countBy(body),
        destiny: destiny
    });
    this.countCreep(room, entry);
};
mod.unregisterCreep = function(creepName){
    delete Memory.population[creepName];
    delete Memory.creeps[creepName];
};
mod.registerAction = function (creep, action, target, entry) {
    if (global.DEBUG && global.TRACE)
        global.Util.trace('Population', {creepName: this.name, registerAction: action.name, target: target.name || target.id, Population: 'registerAction'});

    if (creep === target)
        throw new Error('attempt to register self target');
    if (entry === undefined)
        entry = this.getCreep(creep.name);
    entry.carryCapacityLeft = creep.carryCapacity - creep.sum;
    let room = creep.room;
    if (room.population === undefined) {
        room.population = {
            typeCount: {},
            typeWeight: {},
            actionCount: {},
            actionWeight: {}
        };
    }
    if (creep.action) {
        // unregister action
        if (room.population.actionCount[creep.action.name] === undefined)
            room.population.actionCount[creep.action.name] = 0;
        else room.population.actionCount[creep.action.name]--;
        if (room.population.actionWeight[creep.action.name] === undefined)
            room.population.actionWeight[creep.action.name] = 0;
        else room.population.actionWeight[creep.action.name] -= entry.weight;
        if (this.actionCount[creep.action.name] === undefined)
            this.actionCount[creep.action.name] = 0;
        else this.actionCount[creep.action.name]--;
        if (this.actionWeight[creep.action.name] === undefined)
            this.actionWeight[creep.action.name] = 0;
        else this.actionWeight[creep.action.name] -= entry.weight;

        delete creep.data.determinatedSpot;
        delete creep.data.determinatedTarget;
    }
    // register action
    entry.actionName = action.name;
    if (room.population.actionCount[action.name] === undefined)
        room.population.actionCount[action.name] = 1;
    else room.population.actionCount[action.name]++;
    if (room.population.actionWeight[action.name] === undefined)
        room.population.actionWeight[action.name] = entry.weight;
    else room.population.actionWeight[action.name] += entry.weight;
    if (this.actionCount[action.name] === undefined)
        this.actionCount[action.name] = 1;
    else this.actionCount[action.name]++;
    if (this.actionWeight[action.name] === undefined)
        this.actionWeight[action.name] = entry.weight;
    else this.actionWeight[action.name] += entry.weight;

    let targetId = target.id || target.name;
    let oldTargetId;
    if (entry.targetId) {
        // unregister target
        let oldTarget = entry.targetId ? Game.getObjectById(entry.targetId) || Game.spawns[entry.targetId] || Game.flags[entry.targetId] : null;
        if (oldTarget) {
            oldTargetId = oldTarget.id || oldTarget.name;
            if (oldTarget.targetOf) {
                let byName = elem => elem.creepName === creep.name;
                let index = oldTarget.targetOf.findIndex(byName);
                if (index > -1) oldTarget.targetOf.splice(index, 1);
            }
        }
    }
    // register target
    entry.targetId = targetId;
    if (target && !ROOT.flagDir.isSpecialFlag(target)) {
        if (target.targetOf === undefined)
            target.targetOf = [entry];
        else target.targetOf.push(entry);
    }
    // clear saved path
    if (targetId !== oldTargetId) {
        delete entry.path;
    }

    creep.action = action;
    creep.target = target;
    creep.data = entry;
};
mod.countCreep = function (room, entry) {
    entry.roomName = room.name;
    if (room.population === undefined) {
        room.population = {
            typeCount: {},
            typeWeight: {},
            actionCount: {},
            actionWeight: {}
        };
    }

    if (room.population.typeCount[entry.creepType] === undefined)
        room.population.typeCount[entry.creepType] = 1;
    else
        room.population.typeCount[entry.creepType]++;

    if (room.population.typeWeight[entry.creepType] === undefined)
        room.population.typeWeight[entry.creepType] = entry.weight;
    else
        room.population.typeWeight[entry.creepType] += entry.weight;

    if (this.typeCount[entry.creepType] === undefined)
        this.typeCount[entry.creepType] = 1;
    else
        this.typeCount[entry.creepType]++;

    if (this.typeWeight[entry.creepType] === undefined)
        this.typeWeight[entry.creepType] = entry.weight;
    else
        this.typeWeight[entry.creepType] += entry.weight;
};
mod.flush = function () {
    this.typeCount = {};
    this.typeWeight = {};
    this.actionCount = {};
    this.actionWeight = {};
    this.died = [];
    this.predictedRenewal = [];
    this.spawned = [];
    this.spawnsToProbe = [];
    if (_.isUndefined(Memory.population))
        Memory.population = {};

};
mod.analyze = function () {
    let p = global.Util.startProfiling('Population.analyze', {enabled: global.PROFILING.CREEPS}),
        register = entry => {
        let creep = Game.creeps[entry.creepName];
        if (!creep) {
            if (global.CENSUS_ANNOUNCEMENTS)
                global.Util.logSystem(entry.homeRoom, global.Util.dye(CRAYON.death, 'Good night ' + entry.creepName + '!'));
            this.died.push(entry.creepName);
        } else {
            creep.data = entry;
            delete creep.action;
            delete creep.target;
            delete creep.flag;
            if (creep.spawning) { // count spawning time
                entry.spawningTime++;
            } else if (creep.ticksToLive > 0 && !creep.data.spawned) { // spawning complete
                creep.data.spawned = true;
                this.spawned.push(entry.creepName);
                if (Game.spawns[entry.motherSpawn])
                    this.spawnsToProbe.push(entry.motherSpawn); // only push living spawns
            } else if (creep.ticksToLive <= (entry.predictedRenewal ? entry.predictedRenewal : entry.spawningTime) && !creep.data.nearDeath) { // will die in ticks equal to spawning time or custom

                creep.data.nearDeath = true;

                if (global.CENSUS_ANNOUNCEMENTS)
                    console.log(global.Util.dye(global.CRAYON.system, entry.creepName + ' &gt; ') + global.Util.dye(global.CRAYON.death, 'Farewell!'), global.Util.stack());

                this.predictedRenewal.push(creep.name);

                if (!this.spawnsToProbe.includes(entry.motherSpawn) && entry.motherSpawn !== 'unknown' && Game.spawns[entry.motherSpawn])
                    this.spawnsToProbe.push(entry.motherSpawn);
            }

            entry.ttl = creep.ticksToLive;

            if (entry.creepType &&
                (creep.ticksToLive === undefined ||
                    Creep.Setup.isWorkingAge(entry))) {
                this.countCreep(creep.room, entry);
            }

            if (entry.flagName) {
                let flag = Game.flags[entry.flagName];
                if (!flag)
                    delete entry.flagName;
                else {
                    if (flag.targetOf === undefined) flag.targetOf = [entry];
                    else flag.targetOf.push(entry);
                    creep.flag = flag;
                }
            }
            let action = (entry.actionName && Creep.action[entry.actionName]) ? Creep.action[entry.actionName] : null;
            let target = action && entry.targetId ? Game.getObjectById(entry.targetId) || Game.spawns[entry.targetId] || Game.flags[entry.targetId] : null;
            if (target && target.id === creep.id) {
                target = GLOBAL.flagDir.specialFlag();
            }
            if (action && target) this.registerAction(creep, action, target, entry);
            else {
                delete entry.actionName;
                delete entry.targetId;
                creep.action = null;
                creep.target = null;
            }

            if (entry.hull === undefined) {
                _.assign(entry, mod.getCombatStats(creep.body));
            }

            creep.data = entry;
        }
    };
    _.forEach(Memory.population, c => {
        register(c);
        p.checkCPU('Register: ' + c.creepName, global.PROFILING.ANALYZE_LIMIT / 2);
    });

    let validateAssignment = entry => {
        let creep = Game.creeps[entry.creepName];
        if (creep && creep.action && creep.target) {
            let oldId = creep.target.id || creep.target.name;
            let target = creep.action.validateActionTarget(creep, creep.target);
            if (!target) {
                delete entry.actionName;
                delete entry.targetId;
                creep.action = null;
                creep.target = null;
            } else if (oldId !== target.id || target.name) {
                this.registerAction(creep, creep.action, target, entry);
            }
        }
    };
    _.forEach(Memory.population, c => {
        validateAssignment(c);
        p.checkCPU('Validate: ' + c.creepName, PROFILING.ANALYZE_LIMIT / 2);
    });
};
mod.execute = function () {
    const p = global.Util.startProfiling('Population.execute', {enabled: global.PROFILING.CREEPS});
    let triggerCompleted = name => Creep.spawningCompleted.trigger(Game.creeps[name]);
    this.spawned.forEach(triggerCompleted);
    p.checkCPU('triggerCompleted', global.PROFILING.EXECUTE_LIMIT / 4);

    // Creep.died.on(n => console.log(`Creep ${n} died!`));
    Creep.died.on(c => {
        let data = Memory.population[c];
        if (data && data.determinatedSpot && data.roomName)
            Room.costMatrixInvalid.trigger(data.roomName);
    });
    let triggerDied = name => Creep.died.trigger(name);
    this.died.forEach(triggerDied);
    p.checkCPU('triggerDied', global.PROFILING.EXECUTE_LIMIT / 4);

    let triggerRenewal = name => Creep.predictedRenewal.trigger(Game.creeps[name]);
    this.predictedRenewal.forEach(triggerRenewal);
    p.checkCPU('triggerRenewal', global.PROFILING.EXECUTE_LIMIT / 4);

    if (Game.time % global.SPAWN_INTERVAL !== 0) {
        let probeSpawn = spawnName => Game.spawns[spawnName].execute();
        this.spawnsToProbe.forEach(probeSpawn);
        p.checkCPU('probeSpawn', global.PROFILING.EXECUTE_LIMIT / 4);
    }
};
mod.cleanup = function(){
    const p = global.Util.startProfiling('Population.cleanup', {enabled: PROFILING.CREEPS});
    let unregister = name => mod.unregisterCreep(name);
    this.died.forEach(unregister);
    p.checkCPU('died', global.PROFILING.FLUSH_LIMIT);
    // TODO consider clearing target here
};
mod.getCombatStats = function (body) {
    let i = 0;

    let hull = 99;
    let coreHits = body.length * 100 - 99;
    for (; i < body.length; i++) {
        if (global.CREEP_STATS.creep.coreParts[body[i].type]) {
            break;
        }
        hull = hull + (global.CREEP_STATS.creep.boost.hits[body[i].boost] || 100);
        coreHits = coreHits - 100;
    }

    return {
        hull, // damage needed to impede movement
        coreHits // if (hits < coreHits) missing moves!
    };
};

