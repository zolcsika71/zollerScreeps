"use strict";

let mod = {};
module.exports = mod;

mod.NPC =  {
    ["Source Keeper"]: true,
    ["Invader"]: true
};
mod.CONST = {
    MY_SCORE: 1000,
    WHITELIST_SCORE: 200,
    ALLY: 100,
    NEUTRAL: 1,
    NPC_SCORE: -200
};
mod.name = 'reputation';
mod.myName = () => global.ME;
mod.isNPC = username => mod.NPC[username] === true;
mod.npcOwner = creep => creep.owner && mod.isNPC(creep.owner.username);
mod.isAlly = username => mod.score(username) >= mod.CONST.ALLY;
mod.notAlly = username => !mod.isAlly(username);
mod.allyOwner = creep => creep.owner && mod.isAlly(creep.owner.username);
mod.isHostile = username => mod.score(username) < mod.CONST.NEUTRAL;
mod.notHostile = username => !mod.isHostile(username);
mod.hostileOwner = creep => creep.owner && mod.isHostile(creep.owner.username);
mod.whitelist = () => mod.cache('whitelist');
mod.score = username => {
    let reps = mod.cache('score');
    if (username === undefined)
        return reps;
    let name = username && username.toLowerCase();
    if (reps[name])
        return reps[name];
    else
        return reps[name] = 0;

};
mod.setScore = (username, score) => {
    let name = username && username.toLowerCase();
    mod.score()[name] = score;
    mod.playerMemory(name).score = score;
};
mod.flush = () => {
    mod._loadWhitelist();
    mod._loadScore();
};
mod.cache = table => global.Task.cache(mod.name, table);
mod.killScoreCache = () => {
    global.Task.clearCache(mod.name, 'score');
    return mod.score();
};
mod.killWhitelistCache = () => {
    global.Task.clearCache(mod.name, 'score');
    global.Task.clearCache(mod.name, 'whitelist');
    return mod.whitelist();
};
mod.memory = table => global.Task.memory(mod.name, table);
mod.playerMemory = username => {
    let playerMemory = mod.memory('players'),
        name = username && username.toLowerCase();
    if (playerMemory[name]) {
        return playerMemory[name];
    } else {
        return playerMemory[name] = {};
    }
};
mod._loadScore = () => {
    let etc = mod.cache('etc'),
        playerMemory = mod.memory('players'),
        whitelist = mod.whitelist();

    let score = mod.score();
    if (_.keys(playerMemory).length + _.keys(whitelist).length !== _.keys(score).length + etc.whitelistRepUnion) {
        score = mod.killScoreCache();
        for (let n in mod.NPC) {
            score[n] = mod.CONST.NPC_SCORE;
        }
        _.keys(whitelist).forEach(player => {
            score[player] = mod.CONST.WHITELIST_SCORE;
        });

        etc.whitelistRepUnion = 0;
        _.reduce(playerMemory, (list, player, name) => {
            if (typeof player.score === "number") {
                if (whitelist[name]) {
                    etc.whitelistRepUnion++;
                }
                list[name] = player.score;
            }
            return list;
        }, score);

        mod.setScore(mod.myName(), mod.CONST.MY_SCORE);
    }
};
mod._loadWhitelist = () => {
    let whitelist = mod.whitelist();
    if (_.keys(whitelist).length !== global.PLAYER_WHITELIST.length) {
        whitelist = mod.killWhitelistCache();

        _.forEach(global.PLAYER_WHITELIST, playerName => {
            whitelist[playerName.toLowerCase()] = true;
        });
    }
};







