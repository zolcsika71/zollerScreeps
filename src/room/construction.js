"use strict";

let mod = {};
module.exports = mod;
mod.register = function() {
    Flag.found.on(flag => Room.roomLayout(flag));
};
mod.analyzeRoom = function(room, needMemoryResync) {
    if (needMemoryResync) {
        room.processConstructionFlags();
    }
    room.roadConstruction();
};

