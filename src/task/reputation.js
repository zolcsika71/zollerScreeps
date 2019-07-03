"use strict";

let mod = {};
module.exports = mod;

mod.CONST = {
    MY_SCORE: 1000,
    WHITELIST_SCORE: 200,
    ALLY: 100,
    NEUTRAL: 1,
    NPC_SCORE: -200
};

mod.cache = table => Task.cache(mod.name, table);
mod.score = username => {
    const reps = mod.cache('score');
    if(username === undefined)
        return reps;
    const name = username && username.toLowerCase();
    if(reps[name])
        return reps[name];
    else
        return reps[name] = 0;

};
mod.isHostile = username => mod.score(username) < mod.CONST.NEUTRAL;
mod.hostileOwner = creep => creep.owner && mod.isHostile(creep.owner.username);

