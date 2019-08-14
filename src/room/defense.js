"use strict";

let mod = {};
module.exports = mod;
mod.analyzeRoom = function (room) {
    if (room.hostiles.length || (room.memory.hostileIds && room.memory.hostileIds.length)) room.processInvaders();
};
let triggerNewInvaders = creep => {
    // create notification
    const bodyCount = JSON.stringify(_.countBy(creep.body, 'type'));
    if (global.DEBUG || global.NOTIFICATE_INVADER || (global.NOTIFICATE_INTRUDER && creep.room.my) || global.NOTIFICATE_HOSTILES)
        global.Util.logSystem(creep.pos.roomName, `Hostile intruder (${bodyCount}) from "${creep.owner.username}".`);
    if (global.NOTIFICATE_INVADER || (global.NOTIFICATE_INTRUDER && creep.owner.username !== 'Invader' && creep.room.my) || (global.NOTIFICATE_HOSTILES && creep.owner.username !== 'Invader')) {
        Game.notify(`Hostile intruder ${creep.id} (${bodyCount}) from "${creep.owner.username}" in room ${creep.pos.roomName} at ${global.toDateTimeString(global.toLocalDate(new Date()))}`);
    }
    // trigger subscribers
    Room.newInvader.trigger(creep);
};
let triggerKnownInvaders = id =>  Room.knownInvader.trigger(id);
let triggerGoneInvaders = id =>  Room.goneInvader.trigger(id);
mod.executeRoom = function (memory, roomName) {
    let p = global.Util.startProfiling(roomName + '.defense.execute', {enabled: global.PROFILING.ROOMS}),
        room = Game.rooms[roomName];
    if (room) { // has sight
        room.goneInvader.forEach(triggerGoneInvaders);
        p.checkCPU('goneInvader', 0.5);
        room.hostileIds.forEach(triggerKnownInvaders);
        p.checkCPU('knownInvaders', 0.5);
        room.newInvader.forEach(triggerNewInvaders);
        p.checkCPU('newInvaders', 0.5);
    } else { // no sight
        if (memory.hostileIds) _.forEach(memory.hostileIds, triggerKnownInvaders);
        p.checkCPU('knownInvadersNoSight', 0.5);
    }
};
mod.flushRoom = function (room) {
    room.newInvader = [];
    room.goneInvader = [];
};
