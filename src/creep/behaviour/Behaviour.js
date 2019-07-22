"use strict";

const
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)

    };

let Behaviour = function (name) { // base class for behaviours
        this.name = name;
        this.actions = (creep) => []; // priority list of non resource based actions
        this.inflowActions = (creep) => []; // priority list of actions for getting resources
        this.outflowActions = (creep) => []; // priority list of actions for using resources
        this.assignAction = function (creep, action, target, debouncePriority) {

            const p = GLOBAL.util.startProfiling(creep.name + '.assignAction' + ':' + action.name || action, {enabled: global.PROFILING.BEHAVIOUR});

            let valid,
                addable;

            if (typeof action === 'string')
                action = Creep.action[action];

                valid = action.isValidAction(creep);

            if (global.DEBUG && global.TRACE)
                GLOBAL.util.trace('Action', {actionName: action.name, behaviourName: this.name, creepName: creep.name, valid, Action: 'isValidAction'});
            if (!valid) {
                p.checkCPU('!valid', 0.3);
                return false;
            }
            p.checkCPU('valid', 0.3);

                addable = action.isAddableAction(creep);

            if (global.DEBUG && global.TRACE)
                GLOBAL.util.trace('Action', {actionName: action.name, behaviourName: this.name, creepName: creep.name, addable, Action: 'isAddableAction'});
            if (!addable) {
                p.checkCPU('!addable', 0.3);
                return false;
            }
            p.checkCPU('addable', 0.3);

            const assigned = action.assignDebounce ? action.assignDebounce(creep, debouncePriority, target) : action.assign(creep, target);
            if (assigned) {
                if (global.DEBUG && global.TRACE)
                    GLOBAL.util.trace('Behaviour', {actionName: action.name, behaviourName: this.name, creepName: creep.name,
                    assigned, Behaviour: 'nextAction', Action: 'assign', target: creep.target.id || creep.target.name});

                creep.data.lastAction = action.name;
                creep.data.lastTarget = creep.target.id;
                p.checkCPU('assigned', 0.3);
                return true;

            } else if (global.DEBUG && global.TRACE)
                GLOBAL.util.trace('Action', {actionName: action.name, behaviourName: this.name, creepName: creep.name, assigned, Behaviour: 'assignAction', Action: 'assign'});

            p.checkCPU('!assigned', 0.3);
            return false;
        };
        this.selectInflowAction = function (creep) {
            const
                p = GLOBAL.util.startProfiling('selectInflowAction' + creep.name, {enabled: global.PROFILING.BEHAVIOUR}),
                actionChecked = {},
                outflowActions = this.outflowActions(creep);

            for (let action of this.inflowActions(creep)) {
                if (!actionChecked[action.name]) {
                    actionChecked[action.name] = true;
                    if (this.assignAction(creep, action, undefined, outflowActions)) {
                        p.checkCPU('assigned' + action.name, 1.5);
                        return;
                    }
                }
            }
            p.checkCPU('!assigned', 1.5);
            return Creep.action.idle.assign(creep);
        };
        this.selectAction = function (creep, actions) {
            let p = GLOBAL.util.startProfiling('selectAction' + creep.name, {enabled: global.PROFILING.BEHAVIOUR}),
                actionChecked = {};
            for (let action of actions) {
                // new line (action !== null && action !== undefined)
                if (action !== null && action !== undefined && !actionChecked[action.name]) {
                    //GLOBAL.util.logSystem(creep.name, `action: ${global.json(action.name)}`);
                    actionChecked[action.name] = true;
                    if (this.assignAction(creep, action)) {
                        p.checkCPU('assigned' + action.name, 1.5);
                        return;
                    }
                }
            }

            p.checkCPU('!assigned', 1.5);
            return Creep.action.idle.assign(creep);
        };
        this.nextAction = function (creep) {
            return this.selectAction(creep, this.actions(creep));
        };
        this.needEnergy = creep => creep.sum < creep.carryCapacity / 2;
        this.nextEnergyAction = function (creep) {
            if (this.needEnergy(creep)) {
                return this.selectInflowAction(creep);
            } else {
                if (creep.data.nextAction && creep.data.nextTarget) {
                    const
                        action = Creep.action[creep.data.nextAction],
                        target = Game.getObjectById(creep.data.nextTarget);

                    delete creep.data.nextAction;
                    delete creep.data.nextTarget;

                    if (this.assignAction(creep, action, target))
                        return true;
                }
                return this.selectAction(creep, this.outflowActions(creep));
            }
        };
        this.invalidAction = function (creep) {
            return !creep.action;
        };
        this.run = function (creep) {
            // Assign next Action
            if (this.invalidAction(creep)) {
                if (creep.data.destiny && creep.data.destiny.task && Task[creep.data.destiny.task] && Task[creep.data.destiny.task].nextAction) {
                    Task[creep.data.destiny.task].nextAction(creep);
                } else {
                    this.nextAction(creep);
                }
            }

            // Do some work
            if (creep.action && creep.target) {
                if (global.DEBUG && global.TRACE)
                    GLOBAL.util.trace('Behaviour', {actionName: creep.action.name, behaviourName: this.name, creepName: creep.name, target: creep.target.id || creep.target.name, Action: 'run'});
                creep.action.step(creep);
            } else {
                GLOBAL.util.logError('Creep without action/activity!\nCreep: ' + creep.name + '\ndata: ' + JSON.stringify(creep.data));
            }
        };
        this.assign = function (creep) {
            creep.data.creepType = this.name;
        };
        this.strategies = {
            defaultStrategy: {
                name: `default-${this.name}`
            }
        };
        this.selectStrategies = function (actionName) {
            return [this.strategies.defaultStrategy, this.strategies[actionName]];
        };
    };
module.exports = Behaviour;
