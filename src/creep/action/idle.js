"use strict";

const
    ROOT = {
        flagDir: require('./flagDir')
    };

let action = new Creep.Action('idle');
module.exports = action;
action.targetRange = 3;
action.isValidAction = function (creep) {
    return true;
};
action.isAddableAction = function (creep) {
    return true;
};
action.isAddableTarget = function (target) {
    return true;
};
action.newTarget = function (creep) {
    return ROOT.flagDir.specialFlag();
};
action.step = function (creep) {
    if (global.CHATTY)
        creep.say(this.name, global.SAY_PUBLIC);
    if (creep.getStrategyHandler([action.name], 'idleMove', creep))
        creep.idleMove();

    if (_.isUndefined(creep.data.idleCooldown))
        creep.data.idleCooldown = global.COOLDOWN.CREEP_IDLE;
    else
        creep.data.idleCooldown--;

    if (creep.data.idleCooldown === 0 || creep.ticksToLive > 1450) { // viral line
        delete creep.data.actionName;
        delete creep.data.targetId;
        delete  creep.data.idleCooldown;
    }

};
action.defaultStrategy.idleMove = (creep) => true;