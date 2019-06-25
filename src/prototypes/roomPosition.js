"use strict";

let mod = {};
module.exports = mod;
mod.extend = function () {


    RoomPosition.prototype.findClosestByPathFinder = function (goals, itr=_.identity) {
        let mapping = _.map(goals, itr);
        if (_.isEmpty(mapping))
            return {goal: null};
        let result = PathFinder.search(this, mapping, {
            maxOps: 16000,
            roomCallback: (roomName) => {
                let room = Game.rooms[roomName];
                if (!room) return;
                return room.structureMatrix;
            }
        });
        let last = _.last(result.path);
        if (last === undefined)
            last = this;
        // return {goal: null};
        let goal = _.min(goals, g => last.getRangeTo(g.pos));
        return {
            goal: (Math.abs(goal) !== Infinity) ? goal : null,
            cost: result.cost,
            ops: result.ops,
            incomplete: result.incomplete
        }
    };

    RoomPosition.prototype.findClosestSpawn = function() {
        return this.findClosestByPathFinder(Game.spawns, (spawn) => ({pos: spawn.pos, range: 1})).goal;
    };

};


