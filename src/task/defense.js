"use strict";

// Defense task handles spotted invaders. Spawns defenders and gives them special behaviour.
let mod = {};
module.exports = mod;
// hook into events
mod.register = () => {};

// When a new invader has been spotted
mod.handleNewInvader = invaderCreep => {
    // ignore if on blacklist
    if (!global.SPAWN_DEFENSE_ON_ATTACK || global.DEFENSE_BLACKLIST.includes(invaderCreep.pos.roomName))
        return;
    // if not our room and not our reservation

    global.logSystem(invaderCreep.pos.roomName, `Hostile Invaders detected`);

    if (!invaderCreep.room.my && !invaderCreep.room.reserved) {
        // if it is not our exploiting target
        let validColor = flagEntry => (
            (Flag.compare(flagEntry, global.FLAG_COLOR.invade.exploit)) ||
            (flagEntry.color === global.FLAG_COLOR.claim.color)
        );
        let flag = global.FlagDir.find(validColor, invaderCreep.pos, true);

        if (!flag) {
            global.logSystem(invaderCreep.pos.roomName, `Hostile Invaders not in range`);
            return; // ignore invader
        }
    }
    // check room threat balance

    global.logSystem(invaderCreep.pos.roomName, `THREAT: ${invaderCreep.room.hostileThreatLevel} DEFENSE: ${invaderCreep.room.defenseLevel.sum}`);

    if (invaderCreep.room.defenseLevel.sum > invaderCreep.room.hostileThreatLevel) {
        // room can handle that
        global.logSystem(invaderCreep.pos.roomName, `Defense HIGHER than Threat`);

    } else {
        // order a defender for each invader (if not happened yet)
        global.logSystem(invaderCreep.pos.roomName, `Defense LOWER than Threat`);
        let lastAllocatedGUID = global.guid();
        invaderCreep.room.hostiles.forEach(hostile => {
            mod.orderDefenses(hostile, lastAllocatedGUID);
        });
    }
};
// When an invader leaves a room
mod.handleGoneInvader = invaderId => {
    // check if invader died or in an other room (requires vision)
    let invader = Game.getObjectById(invaderId);
    if (!invader) {
        // Invader not found anymore
        // remove queued creeps
        let taskMemory = mod.memory(invaderId);
        if (taskMemory && taskMemory.defender) {
            let removeQueued = entry => {
                let roomMemory = Memory.rooms[entry.spawnRoom];
                if (roomMemory && roomMemory.spawnQueueHigh) {
                    let thisEntry = queued => queued.destiny && queued.destiny.task === 'defense' && queued.destiny.invaderId === invaderId;
                    let index = roomMemory.spawnQueueHigh.findIndex(thisEntry);
                    if (index > -1) roomMemory.spawnQueueHigh.splice(index, 1);
                }
            };
            taskMemory.defender.forEach(removeQueued);
        }

        // cleanup task memory
        global.Task.clearMemory('defense', invaderId);
        // other existing creeps will recycle themself via nextAction (see below)
        //if (Game.time % 500 === 0)
        if (Object.keys(Memory.allocateProperties.lastAllocated).length > 0) {
            console.log(`${invaderId} unAllocate started for defense`);
            global.unAllocateCompound('defense');
        }
    }
};
// when a creep died
mod.handleCreepDied = creepName => {
    // check if its our creep
    let creepMemory = Memory.population[creepName];
    if (!creepMemory || !creepMemory.destiny || !creepMemory.destiny.task || creepMemory.destiny.task !== 'defense' || !creepMemory.destiny.invaderId)
        return;
    // check if the invader is still there
    let invader = Game.getObjectById(creepMemory.destiny.invaderId);
    if (!invader)
        return;

    // remove died creep from mem
    let taskMemory = mod.memory(creepMemory.destiny.invaderId);
    if (taskMemory.defender) {
        let thisEntry = e => e.order === creepMemory.destiny.order;
        let index = taskMemory.defender.findIndex(thisEntry);
        if (index > -1) taskMemory.defender.splice(index, 1);
    }
    // order reinforements
    mod.orderDefenses(invader);
};
// get task memory
mod.memory = invaderId => {
    return Task.memory('defense', invaderId);
};
mod.creep = {
    defender: {
        fixedBody: [RANGED_ATTACK, MOVE],
        multiBody: {
            [HEAL]: 1,
            [MOVE]: 2,
            [RANGED_ATTACK]: 2,
            [TOUGH]: 1
        },
        name: "defender",
        behaviour: "warrior",
        queue: 'Low'
    }
};
// spawn defenses against an invader creep
mod.orderDefenses = function (invaderCreep, GUID) {

    //global.BB(invaderCreep);
    //_.forEach(invaderCreep, function (value, key) {
    //    global.logSystem(invaderCreep.pos.roomName, `${key}: ${value}`);
    //});

    let invaderId = invaderCreep.id,
        remainingThreat = invaderCreep.threat,
        taskMemory = mod.memory(invaderId);

    // check if an order has been made already
    if (taskMemory.defender) {
        // defender creeps found. get defender threat
        let getThreat = entry => remainingThreat -= entry.threat;
        taskMemory.defender.forEach(getThreat);
    } else {
        // No defender found.
        taskMemory.defender = [];
    }

    // analyze invader threat and create something bigger

    while (remainingThreat > 0) {

        mod.defense.creep.defender.queue = invaderCreep.room.my ? 'High' : 'Medium';
        mod.defense.creep.defender.minThreat = (remainingThreat * 1.1);

        let collectCompounds = function (fixedBody, multiBody) {

                let compounds = {},
                    bodyParts = _.uniq(fixedBody.concat(multiBody));

                for (let part of bodyParts) {

                    if (!BOOSTS[part])
                        continue;

                    let subCompounds = [];

                    Object.keys(BOOSTS[part]).forEach(category => {
                        subCompounds.push(category);
                    });

                    // reverse order
                    compounds = Object.assign(compounds, {[part]: subCompounds.reverse()})
                }

                return compounds;
            },
            orderId = global.guid(),
            compounds = {},
            invadersRoom = invaderCreep.pos.roomName,
            defender = Task.defense.creep.defender,
            boosted = _.some(invaderCreep.body, function (part) {
                return part.boost !== undefined;
            });

        global.logSystem(invadersRoom, `remainingThreat: ${remainingThreat}`);


        if (boosted && invaderCreep.owner.username !== 'Invader') { // invaderCreep.owner.username !== 'Invader' remove to affect all creeps

            global.logSystem(invadersRoom, `BOOSTED hostile detected!!`);

            //global.logSystem(invadersRoom, `WORK: ${invaderCreep.hasBodyparts(WORK)}`);
            //global.logSystem(invadersRoom, `ATTACK : ${invaderCreep.hasBodyparts(ATTACK)}`);
            //global.logSystem(invadersRoom, `RANGED_ATTACK: ${invaderCreep.hasBodyparts(RANGED_ATTACK)}`);
            //global.logSystem(invadersRoom, `HEAL: ${invaderCreep.hasBodyparts(HEAL)}`);

            if (invaderCreep.hasBodyparts(WORK)) {

                //defender.multiBody = [ATTACK, ATTACK, ATTACK, MOVE];

                defender.fixedBody = [ATTACK, MOVE];
                defender.multiBody = [ATTACK, ATTACK, ATTACK, MOVE];

                //global.logSystem(invadersRoom, `WORK -- BOOST materials: `);

                compounds = collectCompounds(defender.fixedBody, defender.multiBody);
                //global.BB(compounds);
                //global.logSystem(invadersRoom, `fixedBody: ${defender.fixedBody} multiBody: ${defender.multiBody}`);

            } else if ((invaderCreep.hasBodyparts(ATTACK) || invaderCreep.hasBodyparts(RANGED_ATTACK)) && invaderCreep.hasBodyparts(HEAL)) {

                //defender.fixedBody = [];
                //defender.multiBody = [TOUGH, RANGED_ATTACK, HEAL, MOVE];

                defender.fixedBody = [HEAL, HEAL];
                defender.multiBody = [TOUGH, RANGED_ATTACK, HEAL, MOVE];

                //global.logSystem(invadersRoom, `(ATTACK || RANGED_ATTACK) && HEAL -- BOOST materials: `);

                compounds = collectCompounds(defender.fixedBody, defender.multiBody);
                //global.BB(compounds);
                //global.logSystem(invadersRoom, `fixedBody: ${defender.fixedBody} multiBody: ${defender.multiBody}`);


            } else if (!(invaderCreep.hasBodyparts(ATTACK) || invaderCreep.hasBodyparts(RANGED_ATTACK)) && invaderCreep.hasBodyparts(HEAL)) {

                //defender.fixedBody = [RANGED_ATTACK, MOVE];
                //defender.multiBody = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE];

                defender.fixedBody = [HEAL, HEAL, HEAL, HEAL, HEAL];
                defender.multiBody = [TOUGH, RANGED_ATTACK, HEAL, MOVE];

                //global.logSystem(invadersRoom, `!(ATTACK || RANGED_ATTACK) && HEAL BOOST materials: `);

                compounds = collectCompounds(defender.fixedBody, defender.multiBody);
                //global.BB(compounds);
                //global.logSystem(invadersRoom, `fixedBody: ${defender.fixedBody} multiBody: ${defender.multiBody}`);

                return null;
            }
        }
        let queued = Task.spawn(
            defender, { // destiny
                task: 'defense',
                targetName: invaderId,
                invaderId: invaderId,
                spottedIn: invadersRoom,
                order: orderId,
                boosted: boosted
            }, { // spawn room selection params
                targetRoom: invadersRoom,
                maxRange: 2,
                minEnergyCapacity: 800,
                allowTargetRoom: true
            },
            creepSetup => { // callback onQueued
                let memory = mod.memory(invaderId);
                memory.defender.push({
                    spawnRoom: creepSetup.queueRoom,
                    order: creepSetup.destiny.order
                });
                if (global.DEBUG)
                    global.logSystem(creepSetup.queueRoom, `Defender queued for hostile creep ${creepSetup.destiny.order} in ${creepSetup.destiny.spottedIn}`);

                console.log(`DEFENDER will spawn at: ${creepSetup.queueRoom}`);
                if (Object.keys(compounds).length > 0) {
                    global.logSystem(creepSetup.queueRoom, `ALLOCATING to: ${creepSetup.queueRoom}`);
                    //global.BB(invadersRoom);
                    Game.rooms[creepSetup.queueRoom].allocateCompound(compounds, GUID, 'defense', invadersRoom);
                }
            }
        );

        if (queued) {
            let bodyThreat = Creep.bodyThreat(queued.parts);
            remainingThreat -= bodyThreat;
        } else {
            // Can't spawn. Invader will not get handled!
            if (global.TRACE || global.DEBUG)
                global.trace('Task', {task: 'defense', invaderId: invaderId, targetRoom: invadersRoom}, 'Unable to spawn. Invader will not get handled!');
            return;
        }
    }

};

// define action assignment for defender creeps
mod.nextAction = creep => {
    // override behaviours nextAction function
    // this could be a global approach to manipulate creep behaviour

    // if spawning room is under attack defend there (=> defending)
    // if all invader gone, try to find original invaderById and travel there (=> travelling, defending)
    // else travel to ordering room (if no sight or invasion) (=> travelling, defending)
    // else check if there are other invaders nearby (=> travelling, defending)
    // if there is NO invader: recycle creep = travel to spawning room (or nearest), then recycling

    if (creep.data.destiny.boosted && Creep.action.boosting.assign(creep)) {
        return;
    } else {
        // defend current room
        if (Creep.action.defending.isValidAction(creep) &&
            Creep.action.defending.isAddableAction(creep) &&
            Creep.action.defending.assign(creep)) {
            return;
        }
        // travel to invader
        let invader = Game.getObjectById(creep.data.destiny.invaderId);
        if (invader && creep.pos.roomName === invader.pos.roomName) {
            Creep.action.travelling.assign(creep, invader);
            return;
        }
        // travel to initial calling room
        let callingRoom = Game.rooms[creep.data.destiny.spottedIn];
        if (!callingRoom || callingRoom.hostiles.length > 0) {
            return Creep.action.travelling.assignRoom(creep, creep.data.destiny.spottedIn);
        }
        // check adjacent rooms for invasion
        let hasHostile = roomName => Game.rooms[roomName] && Game.rooms[roomName].hostiles.length > 0;
        let invasionRoom = creep.room.adjacentRooms.find(hasHostile);
        if (invasionRoom) {
            return Creep.action.travelling.assignRoom(creep, invasionRoom);
        }
        // recycle self
        let mother = Game.spawns[creep.data.motherSpawn];
        if (mother) {
            Creep.action.recycling.assign(creep, mother);
        }
    }
};

mod.nuked = room => {

    // if ramparts not enough to protect storage sell them all

};




