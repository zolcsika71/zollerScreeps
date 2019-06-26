"use strict";

const
    TASK = {
        mining: require('./task.mining')
    };

let mod = {};
module.exports = mod;

mod.tasks = [];
mod.executeCache = {};

mod.populate = function () {
    mod.addTasks(...[
        //Task.attackController,
        //Task.claim,
        //Task.defense,
        //Task.guard,
        //Task.labTech,
        TASK.mining
        //Task.pioneer,
        //Task.reputation,
        //Task.reserve,
        //Task.robbing,
        //Task.safeGen,
        //Task.scheduler
    ]);
};

mod.addTasks = (...task) => mod.tasks.push(...task);

mod.flush = function () {
    mod.tasks.forEach(task => {
        if (task.flush) task.flush();
    });
};

mod.register = function () {
    mod.tasks.forEach(task => {
        // Extending of any other kind
        if (task.register)
            task.register();
        // Flag Events
        if (task.execute && !mod.executeCache[task.name])
            mod.executeCache[task.name] = {execute: mod.execute};
        if (task.handleFlagFound)
            Flag.found.on(flag => task.handleFlagFound(flag));
        if (task.handleFlagRemoved)
            Flag.FlagRemoved.on(flagName => task.handleFlagRemoved(flagName));
        // Creep Events
        if (task.handleSpawningStarted)
            Creep.spawningStarted.on(params => task.handleSpawningStarted(params));
        if (task.handleSpawningCompleted)
            Creep.spawningCompleted.on(creep => task.handleSpawningCompleted(creep));
        if (task.handleCreepDied) {
            Creep.predictedRenewal.on(creep => task.handleCreepDied(creep.name));
            Creep.died.on(name => task.handleCreepDied(name));
        }
        if (task.handleCreepError)
            Creep.error.on(errorData => task.handleCreepError(errorData));
        // Room events
        if (task.handleNewInvader)
            Room.newInvader.on(invader => task.handleNewInvader(invader));
        if (task.handleKnownInvader)
            Room.knownInvader.on(invaderID => task.handleKnownInvader(invaderID));
        if (task.handleGoneInvader)
            Room.goneInvader.on(invaderID => task.handleGoneInvader(invaderID));
        if (task.handleRoomDied)
            Room.collapsed.on(room => task.handleRoomDied(room));
    });
};

mod.execute = function () {
    _.forEach(Task.executeCache, function (n, k) {
        try {
            n.execute();
        } catch (e) {
            console.log(`Error executing Task "${k}"<br>${e.stack || e.toString()}`);
        }
    });
};

