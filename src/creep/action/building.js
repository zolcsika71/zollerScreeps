"use strict";

let action = new Creep.Action('building');
module.exports = action;
action.maxPerTarget = 3;
action.targetRange = 3;
action.reachedRange = creep => {
    console.log(`Hello rRange!!!`);
    let rRange = creep.getStrategyHandler([action.name], 'reachedRange', creep);
    global.logSystem(`rRange:`, `creep: ${creep.name} rRange: ${rRange}`);
    return rRange;
};
action.maxPerAction = 3;
action.isValidAction = creep => (creep.carry.energy > 0);
action.isAddableAction = function (creep) {
    return (!creep.room.population || !creep.room.population.actionCount[this.name] || creep.room.population.actionCount[this.name] < this.maxPerAction);
};
action.isValidTarget = target => (target != null && (target.my || global.Task.reputation.allyOwner(target)) && target.progress && target.progress < target.progressTotal);
action.isAddableTarget = function (target) {
    //  our site?
    console.log(`reputation: ${global.Task.reputation.allyOwner(target)}`);
    return target && (target.my || global.Task.reputation.allyOwner(target)) && (!target.targetOf || target.targetOf.length < this.maxPerTarget);
};
action.newTarget = function (creep) {
    let that = this,
        isAddable = target => that.isAddableTarget(target, creep);
    return creep.room.getBestConstructionSiteFor(creep.pos, isAddable);
};
action.work = creep => {
    creep.getStrategyHandler([action.name], 'getEnergy', creep);
    return creep.build(creep.target);
};
action.defaultStrategy.reachedRange = 1;
// this allows us to get energy in the same tick if a behaviour defines this strategy, used in behaviour.miner
action.defaultStrategy.getEnergy = creep => false;
