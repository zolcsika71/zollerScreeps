"use strict";

const
    //setup = require(`./creep.setup.Setup`),
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    },
    ROOT = {
        population: require('./population')
    },
    PROPERTIES = {
        room: require('./properties.room')
    };

PROPERTIES.room.extend();

let mod = {};
module.exports = mod;
mod.extend = function () {

    Spawn.prototype.execute = function () {

        if (this.spawning)
            return;
        let room = this.room;
        // old spawning system
        let that = this;

        let probe = (setup) => {
            // plus line
            if (_.isUndefined(setup))
                return false;

            let returnValue = setup.isValidSetup(room) && that.createCreepBySetup(setup);
            console.log(`probe: ${setup.type} returns: ${global.json(returnValue)}`);

            return returnValue;
        };

        const spawnDelay = GLOBAL.util.get(this.room.memory, 'spawnDelay', {});
        let busy = this.createCreepByQueue(room.spawnQueueHigh, 'High');

        // don't spawn lower if there is one waiting in the higher queue
        if (!busy && (room.spawnQueueHigh.length === 0  || room.spawnQueueHigh.length === spawnDelay.High) && Game.time % global.SPAWN_INTERVAL === 0) {
            busy = _.some(Spawn.priorityHigh, probe);

            if (!busy) {
                busy = this.createCreepByQueue(room.spawnQueueMedium, 'Medium');
            }
            if (!busy && (room.spawnQueueMedium.length === 0 || room.spawnQueueMedium.length === spawnDelay.Medium)) {
                busy = _.some(Spawn.priorityLow, probe);
                if (!busy) {
                    busy = this.createCreepByQueue(room.spawnQueueLow, 'Low');
                }
            }
        }
        console.log (`execute returns: ${busy}`);
        return busy;
    };
    Spawn.prototype.createCreepBySetup = function (setup) {
        if (global.DEBUG && global.TRACE)
            GLOBAL.util.trace('Spawn', {setupType: this.type, rcl: this.room.controller.level, energy: this.room.energyAvailable, maxEnergy: this.room.energyCapacityAvailable, Spawn: 'createCreepBySetup'}, 'creating creep');
        let params = setup.buildParams(this);
        console.log(`by setup: ${global.json(params)}`);
        if (this.create(params.parts, params.name, params.setup))
            return params;
        return null;
    };
    Spawn.prototype.createCreepByQueue = function (queue, level) {
        const spawnDelay = GLOBAL.util.get(this.room.memory, 'spawnDelay', {});
        if (!queue)
            return null;
        else if (Memory.CPU_CRITICAL && spawnDelay[level] === queue.length)
            return null;
        let params;
        for (let index = 0; index < queue.length; index++) {
            let entry = queue[index];
            if (Memory.CPU_CRITICAL && !global.CRITICAL_ROLES.includes(entry.behaviour))
                continue;
            else
                params = queue.splice(index, 1)[0];
        }
        if (!params) {
            if (queue.length && global.DEBUG)
                GLOBAL.util.logSystem(this.pos.roomName, 'No non-CRITICAL creeps to spawn, delaying spawn until CPU is not CRITICAL, or new entries are added.');
            spawnDelay[level] = queue.length;
            return null;
        }
        delete spawnDelay[level];
        let cost = 0;
        params.parts.forEach(function (part) {
            cost += BODYPART_COST[part];
        });
        // no parts
        if (cost === 0) {
            GLOBAL.util.logSystem(this.pos.roomName, GLOBAL.util.dye(global.CRAYON.error, 'Zero parts body creep queued. Removed.'));
            return false;
        }
        // wait with spawning until enough resources are available

        //console.log(`remaining: ${this.room.remainingEnergyAvailable}`);

        if (cost > this.room.remainingEnergyAvailable) {
            if (cost > this.room.energyCapacityAvailable || (cost > 300 && !this.room.creeps.length)) {
                GLOBAL.util.logSystem(this.pos.roomName, GLOBAL.util.dye(global.CRAYON.error, 'Queued creep too big for room: ' + JSON.stringify(params)));
                return false;
            }
            queue.unshift(params);
            return true;
        }
        let completeName,
            stumb = params.name;
        for (let son = 1; (completeName == null) || Game.creeps[completeName] || Memory.population[completeName]; son++) {
            completeName = params.name + '-' + son;
        }
        params.name = completeName;
        console.log(`by queue`);
        let result = this.create(params.parts, params.name, params.behaviour || params.setup, params.destiny);
        if (!result) {
            params.name = stumb;
            queue.unshift(params);
        }
        return result;
    };
    Spawn.prototype.create = function (body, name, behaviour, destiny) {
        if (body.length === 0)
            return false;
        let success = this.spawnCreep (body, name, {});
        if (success === OK) {
            let cost = 0;
            body.forEach(function (part) {
                cost += BODYPART_COST[part];
            });
            this.room.reservedSpawnEnergy += cost;
            ROOT.population.registerCreep(
                name,
                behaviour,
                cost,
                this.room,
                this.name,
                body,
                destiny);
            this.newSpawn = {name: name};
            Creep.spawningStarted.trigger({spawn: this.name, name: name, body: body, destiny: destiny, spawnTime: body.length * CREEP_SPAWN_TIME});
            if (global.CENSUS_ANNOUNCEMENTS)
                GLOBAL.util.logSystem(this.pos.roomName, GLOBAL.util.dye(global.CRAYON.birth, 'Good morning ' + name + '!'));
            return true;
        }
        if (global.DEBUG || global.CENSUS_ANNOUNCEMENTS)
            GLOBAL.util.logSystem(this.pos.roomName,
                GLOBAL.util.dye(global.CRAYON.error, 'Offspring failed: ' + GLOBAL.util.translateErrorCode(success) + '<br/> - body: ' + JSON.stringify(_.countBy(body)) + '<br/> - name: ' + name + '<br/> - behaviour: ' + behaviour + '<br/> - destiny: ' + destiny));
        return false;
    };

};

