"use strict";

let mod = {};
module.exports = mod;

mod.CONST = {
    MY_SCORE: 1000,
    WHITELIST_SCORE: 200,
    ALLY: 100,
    NEUTRAL: 1,
    NPC_SCORE: -200,
};

mod.isHostile = username => mod.score(username) < mod.CONST.NEUTRAL;
mod.hostileOwner = creep => creep.owner && mod.isHostile(creep.owner.username);

