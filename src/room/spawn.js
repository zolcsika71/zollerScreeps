"use strict";

let mod = {};
module.exports = mod;
mod.analyzeRoom = function (room, needMemoryResync) {
    if (needMemoryResync) {
        room.saveSpawns();
    }
};
