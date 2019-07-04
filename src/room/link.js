"use strict";

let mod = {};
module.exports = mod;
mod.analyzeRoom = function(room, needMemoryResync) {
    if (needMemoryResync) {
        room.saveLinks();
    }
    if (room.structures.links.all.length > 0) room.linkDispatcher();
};

