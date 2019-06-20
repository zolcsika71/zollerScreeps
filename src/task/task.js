"use strict";

let mod = {};
module.exports = mod;

mod.populate = function() {
    mod.addTasks(...[
        Task.attackController,
        Task.claim,
        Task.defense,
        Task.guard,
        Task.labTech,
        Task.mining,
        Task.pioneer,
        Task.reputation,
        Task.reserve,
        Task.robbing,
        Task.safeGen,
        Task.scheduler,
    ]);
};
mod.addTasks = (...task) => Task.tasks.push(...task);
