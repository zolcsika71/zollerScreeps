"use strict";

const
    GLOBAL = {
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    };


let mod = {};
module.exports = mod;

mod.setCreep = function (val) {
    Memory.population[val.creepName] = val;
    return Memory.population[val.creepName];
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
    let p = GLOBAL.util.startProfiling('Population.analyze', {enabled: global.PROFILING.CREEPS}),
        register = entry => {
        let creep = Game.creeps[entry.creepName];
        if (!creep) {
            if (global.CENSUS_ANNOUNCEMENTS)
                global.logSystem(entry.homeRoom, global.dye(CRAYON.death, 'Good night ' + entry.creepName + '!'));
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
                    console.log(global.dye(global.CRAYON.system, entry.creepName + ' &gt; ') + global.dye(CRAYON.death, 'Farewell!'), Util.stack());

                this.predictedRenewal.push(creep.name);

                if (!this.spawnsToProbe.includes(entry.motherSpawn) && entry.motherSpawn != 'unknown' && Game.spawns[entry.motherSpawn])
                    this.spawnsToProbe.push(entry.motherSpawn);
            }

            entry.ttl = creep.ticksToLive;

            if (entry.creepType &&
                (creep.ticksToLive === undefined ||
                    Creep.Setup.isWorkingAge(entry))) {
                this.countCreep(creep.room, entry);
            }

            if (entry.flagName) {
                var flag = Game.flags[entry.flagName];
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
                target = FlagDir.specialFlag();
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
        p.checkCPU('Register: ' + c.creepName, PROFILING.ANALYZE_LIMIT / 2);
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
            } else if (oldId != target.id || target.name) {
                this.registerAction(creep, creep.action, target, entry);
            }
        }
    };
    _.forEach(Memory.population, c => {
        validateAssignment(c);
        p.checkCPU('Validate: ' + c.creepName, PROFILING.ANALYZE_LIMIT / 2);
    });
};

