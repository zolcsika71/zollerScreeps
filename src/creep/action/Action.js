"use strict";

// base class for every action
let Action = function (actionName) {
    // action name
    this.name = actionName;
    // max allowed creeps per target
    this.maxPerTarget = Infinity;
    // max allowed creeps per action (and room)
    this.maxPerAction = Infinity;
    // range within which the action can be executed (e.g. upgrade controller = 3)
    this.targetRange = 1;
    // range until which the target has been reached. (e.g. can be less than targetRange)
    this.reachedRange = 1;
    // if true, will try to find new target if a target has become invalid
    // if false, an invalid target wil invalidate the action as well (causing to get a new action)
    this.renewTarget = true;
    // get unique identifier of any object (id or name)
    this.getTargetId = target => target.id || target.name;
    // get an object by its unique identifier (id or name)
    this.getTargetById = id => Game.getObjectById(id) || Game.spawns[id] || Game.flags[id];
    // determines, if an action is (still) valid. Gets validated each tick.
    // check possible override in derived action
    this.isValidAction = creep => true;
    // determines, if a target is (still) valid. Gets validated each tick.
    // check possible override in derived action
    this.isValidTarget = (target, creep) => target != null;
    // determines, if an action is valid. Gets validated only once upon assignment.
    // check possible override in derived action
    this.isAddableAction = function (creep) {
        return this.maxPerAction === Infinity || !creep.room.population || !creep.room.population.actionCount[this.name] || creep.room.population.actionCount[this.name] < this.maxPerAction;
    };
    // determines, if a target is valid. Gets validated only once upon assignment.
    // check possible override in derived action
    this.isAddableTarget = function (target, creep) { // target is valid to be given to an additional creep
        return !target.targetOf || this.maxPerTarget === Infinity || _.filter(target.targetOf, {'actionName': this.name}).length < this.maxPerTarget;
    };
    // find a new target for that action
    // needs implementation in derived action
    this.newTarget = creep => null;
    this.unassign = creep => {
        delete creep.data.actionName;
        delete creep.data.targetId;
        delete creep.action;
        delete creep.target;
    };
    // order for the creep to execute each tick, when assigned to that action
    this.step = function (creep) {
        if (global.CHATTY)
            creep.say(this.name, global.SAY_PUBLIC);
        let range = creep.pos.getRangeTo(creep.target);
        if (range <= this.targetRange) {
            let workResult = this.work(creep);
            if (workResult !== OK) {
                creep.handleError({errorCode: workResult, action: this, target: creep.target, range, creep});
                return this.unassign(creep);
            }
            range = creep.pos.getRangeTo(creep.target); // target may have changed (eg. hauler feed+move/tick)
        }
        if (creep.target && creep.hasActiveBodyparts(MOVE)) {

            if (range > this.targetRange) {
                //console.log(`target: ${global.json(creep.target)} range: ${this.targetRange}`);
                creep.travelTo(creep.target, {range: this.targetRange});
            }
            // low CPU pathfinding for last few steps.
            else if (range > this.reachedRange) {
                const
                    direction = creep.pos.getDirectionTo(creep.target),
                    targetPos = Traveler.positionAtDirection(creep.pos, direction);

                if (creep.room.isWalkable(targetPos.x, targetPos.y)) { // low cost last steps if possible
                    creep.move(direction);
                } else if (!creep.pos.isNearTo(creep.target)) { // travel there if we're not already adjacent
                    let travelData = {};
                    creep.travelTo(creep.target, {range: this.reachedRange, returnData: travelData});
                    console.log(`travelData: ${global.json(travelData)}`);
                }
            }
        }
    };
    // order for the creep to execute when at target
    this.work = creep => ERR_INVALID_ARGS;
    // validate, if this action is still valid for a certain creep and target
    // returns the target (could be a ne one) if valid or null
    this.validateActionTarget = function (creep, target) {
        if (this.isValidAction(creep)) {
            // validate target or new
            if (this.isValidTarget(target, creep)) {
                return target;
            } else if (this.renewTarget) {
                // invalid. try to find a new one...
                delete creep.data.path;
                return this.newTarget(creep);
            }

        }
        return null;
    };
    // assign the action to a creep
    // optionally predefine a fixed target
    this.assign = function (creep, target) {
        if (target === undefined) target = this.newTarget(creep);
        if (target && this.isAddableTarget(target, creep)) {
            if (global.DEBUG && global.TRACE)
                global.trace('Action', {creepName: creep.name, assign: this.name, target: !target || target.name || target.id, Action: 'assign'});
            if (!creep.action || creep.action.name !== this.name || !creep.target || creep.target.id !== target.id || creep.target.name !== target.name) {
                global.Population.registerAction(creep, this, target);
                this.onAssignment(creep, target);
            }
            return true;
        }
        return false;
    };
    this.showAssignment = function (creep, target) {
        if (global.SAY_ASSIGNMENT && global.ACTION_SAY[this.name.toUpperCase()])
            creep.say(global.ACTION_SAY[this.name.toUpperCase()], global.SAY_PUBLIC);
        if (target instanceof RoomObject || target instanceof RoomPosition && global.VISUALS.ACTION_ASSIGNMENT)
            global.Visuals.drawArrow(creep, target);
    };
    // assignment postprocessing
    this.onAssignment = function (creep, target) {
        this.showAssignment(creep, target);
    };
    // empty default strategy
    this.defaultStrategy = {
        name: `default-${actionName}`,
        moveOptions: options => options || {}
    };
    // strategy accessor
    this.selectStrategies = function () {
        return [this.defaultStrategy];
    };
    // get member with this action's name
    this.isMember = function (collection) {
        return _.find(collection, function (a) {
            return a.name === this.name;
        }, this);
    };
    this.getStrategy = function (strategyName, creep, ...args) {
        if (_.isUndefined(args)) return creep.getStrategyHandler([this.name], strategyName);
        else return creep.getStrategyHandler([this.name], strategyName, ...args);
    };
};
module.exports = Action;
