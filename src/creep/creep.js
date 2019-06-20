const strategy = require('./strategy');

let mod = {};
module.exports = mod;

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
