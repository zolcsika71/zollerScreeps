"use strict";

let mod = {};
module.exports = mod;
mod.analyzeRoom = function(room, needMemoryResync) {
    if (needMemoryResync) {
        room.saveLabs();
    }
    if (room.structures.labs.all.length > 0) room.processLabs();
};