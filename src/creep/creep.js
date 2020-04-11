"use strict";

let mod = {};
module.exports = mod;

mod.execute = function () {
    if (global.DEBUG && Memory.CPU_CRITICAL)
        global.logSystem('system', `${Game.time}: CPU Bucket level is critical (${Game.cpu.bucket}). Skipping non critical creep roles.`);
    let run = creep => {
        try {
            creep.run();
        } catch (e) {
            console.log('<span style="color:FireBrick">Creep ' + creep.name + (e.stack || e.toString()) + '</span>', global.stack());
        }
    };
    _.forEach(Game.creeps, run);
};
mod.bodyCosts = function (body) {
    let costs = 0;
    if (body) {
        body.forEach(part => {
            costs += BODYPART_COST[part];
        });
    }
    return costs;
};

// params: {minThreat, minWeight, maxWeight, minMulti, maxMulti}
// calculates the multi that is above the smallest minimum, and below the largest maximum based on parameters
mod.multi = (room, params = {}) => {
    let minMulti = params.minMulti || 0,
        fixedCosts = Creep.bodyCosts(params.fixedBody),
        multiCosts = Creep.bodyCosts(params.multiBody);
    if (multiCosts === 0) return 0; // prevent divide-by-zero
    let maxThreatMulti = Infinity;
    if (params.minThreat) {
        let fixedThreat = Creep.bodyThreat(params.fixedBody),
            multiThreat = Creep.bodyThreat(params.multiBody);
        maxThreatMulti = 0;
        let threat = fixedThreat;
        while (threat < params.minThreat) {
            maxThreatMulti += 1;
            threat += multiThreat;
        }
    }
    let minWeightMulti = 0;
    if (params.minWeight) {
        let weight = fixedCosts;
        while (weight < params.minWeight) {
            minWeightMulti += 1;
            weight += multiCosts;
        }
    }
    let maxPartsMulti = Math.floor((50 - params.fixedBody.length) / params.multiBody.length),
        maxEnergy = params.currentEnergy ? room.energyAvailable : room.energyCapacityAvailable,
        maxAffordableMulti = Math.floor((maxEnergy - fixedCosts) / multiCosts),
        maxWeightMulti = params.maxWeight ? Math.floor((params.maxWeight - fixedCosts) / multiCosts) : Infinity,
        maxMulti = params.maxMulti || Infinity,
        // find the smallest maximum to set our upper bound
        max = _.min([maxAffordableMulti, maxThreatMulti, maxWeightMulti, maxMulti]),
        // ensure we are above our lower bound
        min = _.max([minMulti, minWeightMulti, max]);

    // ensure this won't result in more than 50 parts
    return _.min([maxPartsMulti, min]);
};
mod.partsComparator = function (a, b) {
    let partsOrder = [TOUGH, CLAIM, WORK, CARRY, ATTACK, RANGED_ATTACK, HEAL, MOVE];
    let indexOfA = partsOrder.indexOf(a);
    let indexOfB = partsOrder.indexOf(b);
    return indexOfA - indexOfB;
};
mod.formatParts = function (parts) {
    if (parts && !Array.isArray(parts) && typeof parts === 'object') {
        let body = [];

        for (let part of BODYPARTS_ALL)
            if (part in parts)
                body.push(..._.times(parts[part], n => part));

        parts = body;
    }
    return parts;
};
mod.formatBody = function (fixedBody, multiBody) {
    fixedBody = mod.formatParts(fixedBody);
    multiBody = mod.formatParts(multiBody);
    return {fixedBody, multiBody};
};
mod.compileBody = function (room, params, sort = true) {
    const {fixedBody, multiBody} = Creep.formatBody(params.fixedBody || [], params.multiBody || []);
    _.assign(params, {fixedBody, multiBody});
    if (params.sort !== undefined) sort = params.sort;
    let parts = [],
        multi = Creep.multi(room, params);

    for (let i = 0; i < multi; i++)
        parts = parts.concat(params.multiBody);

    parts = parts.concat(params.fixedBody);

    if (sort) {
        let compareFunction = typeof sort === 'function' ? sort : mod.partsComparator;
        parts.sort(compareFunction);
    }
    if (parts.includes(HEAL)) {
        let index = parts.indexOf(HEAL);
        parts.splice(index, 1);
        parts.push(HEAL);
    }
    return parts;
};
mod.bodyThreat = function (body) {
    let threat = 0;
    let evaluatePart = part => {
        threat += global.PART_THREAT[part.type ? part.type : part][part.boost ? 'boosted' : 'common'];
    };
    if (body) body.forEach(evaluatePart);
    return threat;
};
mod.register = function () {
    for (const action in Creep.action) {
        if (Creep.action[action].register) Creep.action[action].register(this);
    }
    for (const behaviour in Creep.behaviour) {
        if (Creep.behaviour[behaviour].register) Creep.behaviour[behaviour].register(this);
    }
    for (const setup in Creep.setup) {
        if (Creep.setup[setup].register) Creep.setup[setup].register(this);
    }
};
