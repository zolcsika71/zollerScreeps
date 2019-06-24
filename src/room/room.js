"use strict";

const
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    };

// save original API functions
let find = Room.prototype.find;

let mod = {};
module.exports = mod;

mod.pathfinderCache = {};
mod.pathfinderCacheLoaded = false;

mod.loadCostMatrixCache = function (cache) {
    let count = 0;
    for (const key in cache) {
        if (!mod.pathfinderCache[key] || mod.pathfinderCache[key].updated < cache[key].updated) {
            count++;
            mod.pathfinderCache[key] = cache[key];
        }
    }
    if (global.DEBUG && count > 0)
        GLOBAL.util.logSystem('RawMemory', 'loading pathfinder cache.. updated ' + count + ' stale entries.');
    mod.pathfinderCacheLoaded = true;
};

