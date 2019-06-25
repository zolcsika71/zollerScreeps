"use strict";

const
    TASK = {
        mining: require('./task.mining')
    };

let mod = {};
module.exports = mod;

mod.tasks = [];
mod.executeCache = {};

mod.populate = function() {
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

