"use strict";

let action = new Creep.Action('bulldozing');
module.exports = action;
action.maxPerAction = 2;
action.maxPerTarget = 1;
action.isValidTarget = target => {
    if (!target.room.my && target.room.controller && target.room.controller.safeMode)
        return false;
    return target instanceof ConstructionSite && global.Task.reputation.notAlly(target.owner.username);
};
action.newTarget = creep => {
    const target = _(creep.room.constructionSites)
        .filter(action.isValidTarget)
        .max(target => {
            let rating;
            if (target.structureType === STRUCTURE_SPAWN) {
                rating = 20000;
            } else {
                rating = 10000;
            }
            rating += target.progress / target.progressTotal * 10000;
            rating -= creep.pos.getRangeTo(target);
            return rating;
        });
    if (target instanceof ConstructionSite)
        return target;
};
action.work = creep => creep.move(creep.pos.getDirectionTo(creep.target));
