const strategy = require('./strategy');

let mod = {};
module.exports = mod;

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

mod.partThreat = {
    'move': { common: 0, boosted: 0 },
    'work': { common: 1, boosted: 3 },
    'carry': { common: 0, boosted: 0 },
    'attack': { common: 2, boosted: 5 },
    'ranged_attack': { common: 2, boosted: 5 },
    'heal': { common: 4, boosted: 10 },
    'claim': { common: 1, boosted: 3 },
    'tough': { common: 1, boosted: 3 },
    tower: 25
};

mod.bodyThreat = function (body) {
    let threat = 0;
    let evaluatePart = part => {
        threat += mod.partThreat[part.type ? part.type : part][part.boost ? 'boosted' : 'common'];
    };
    if (body) body.forEach(evaluatePart);
    return threat;
};

mod.register = function() {
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
