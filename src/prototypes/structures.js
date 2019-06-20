"use strict";

let mod = {};
mod.extend = function () {

    // extensions.js
    StructureStorage.prototype.getNeeds = function (resourceType) {
        var ret = 0;
        if (!this.room.memory.resources) return 0;

        let storageData = this.room.memory.resources.storage[0];
        // look up resource and calculate needs
        let order = null;
        if (storageData) order = storageData.orders.find((o)=> {
            return o.type === resourceType;
        });
        if (!order) order = { orderAmount: 0, orderRemaining: 0, storeAmount: 0 };
        let rcl = this.room.controller.level;
        let loadTarget = Math.max(order.orderRemaining + (this.store[resourceType] || 0), order.storeAmount + ((resourceType === RESOURCE_ENERGY) ? MIN_STORAGE_ENERGY[rcl] : MAX_STORAGE_MINERAL));
        // storage always wants energy
        let unloadTarget = (resourceType === RESOURCE_ENERGY) ? (this.storeCapacity - this.sum) + this.store.energy : order.orderAmount + order.storeAmount + MAX_STORAGE_MINERAL;
        if (unloadTarget < 0) unloadTarget = 0;
        let store = this.store[resourceType] || 0;
        if (store < loadTarget) ret = Math.min(loadTarget - store, this.storeCapacity - this.sum);
        else if (store > unloadTarget * 1.05) ret = unloadTarget - store;
        return ret;
    };
    StructureTerminal.prototype.getNeeds = function (resourceType) {
        var ret = 0;
        if (!this.room.memory.resources) return 0;
        let terminalData = this.room.memory.resources.terminal[0];
        // look up resource and calculate needs
        let order = null;
        if (terminalData) order = terminalData.orders.find((o)=> {
            return o.type === resourceType;
        });
        if (!order) order = { orderAmount: 0, orderRemaining: 0, storeAmount: 0 };
        let loadTarget = Math.max(order.orderRemaining + (this.store[resourceType] || 0), order.storeAmount + ((resourceType === RESOURCE_ENERGY) ? TERMINAL_ENERGY : 0));
        let unloadTarget = order.orderAmount + order.storeAmount + ((resourceType === RESOURCE_ENERGY) ? TERMINAL_ENERGY : 0);
        if (unloadTarget < 0) unloadTarget = 0;
        let store = this.store[resourceType] || 0;
        if (store < loadTarget) ret = Math.min(loadTarget - store, this.storeCapacity - this.sum);
        else if (store > unloadTarget * 1.05) ret = unloadTarget - store;
        return ret;
    };
    StructureContainer.prototype.getNeeds = function (resourceType) {
        if (!this.room.memory.resources) return 0;

        // look up resource and calculate needs
        let containerData = this.room.memory.resources.container.find((s) => s.id === this.id);
        if (containerData) {
            let order = containerData.orders.find((o)=> {
                return o.type === resourceType;
            });
            if (order) {
                let loadTarget = Math.max(order.orderRemaining + (this.store[resourceType] || 0), order.storeAmount);
                let unloadTarget = order.orderAmount + order.storeAmount;
                if (unloadTarget < 0) unloadTarget = 0;
                let store = this.store[resourceType] || 0;
                if (store < loadTarget) return Math.min(loadTarget - store, this.storeCapacity - this.sum);
                if (store > unloadTarget * 1.05) return unloadTarget - store;
            }
        }
        return 0;
    };
    StructureLab.prototype.getNeeds = function (resourceType) {
        if (!this.room.memory.resources) return 0;
        let loadTarget = 0;
        let unloadTarget = 0;
        let reaction = this.room.memory.resources.reactions;

        // look up resource and calculate needs
        let containerData = this.room.memory.resources.lab.find((s) => s.id === this.id);
        if (containerData) {
            let order = containerData.orders.find((o)=> {
                return o.type === resourceType;
            });
            if (order) {
                let amt = 0;
                if (resourceType === RESOURCE_ENERGY) amt = this.energy;
                else if (resourceType === this.mineralType) amt = this.mineralAmount;
                loadTarget = Math.max(order.orderRemaining + amt, order.storeAmount);
                unloadTarget = order.orderAmount + order.storeAmount;
                if (unloadTarget < 0) unloadTarget = 0;
            }
        }
        let store = 0;
        let space = 0;
        let cap = 0;
        if (resourceType === RESOURCE_ENERGY) {
            store = this.energy;
            space = this.energyCapacity - this.energy;
            cap = this.energyCapacity;
        } else {
            if (this.mineralType === resourceType) store = this.mineralAmount;
            space = this.mineralCapacity - this.mineralAmount;
            cap = this.mineralCapacity;
        }

        if (containerData && reaction && reaction.orders.length > 0
            && (this.id === reaction.seed_a || this.id === reaction.seed_b)
            && (resourceType !== LAB_REACTIONS[reaction.orders[0].type][0] || resourceType !== LAB_REACTIONS[reaction.orders[0].type][1])) {

            if (store > unloadTarget) {
                return unloadTarget - store;
            }
        }

        if ((store < Math.min(loadTarget, cap) / 2) || store < LAB_REACTION_AMOUNT) return Math.min(loadTarget - store, space);
        if (containerData && containerData.reactionType === this.mineralType) {
            if (store > unloadTarget + (cap - Math.min(unloadTarget, cap)) / 2) return unloadTarget - store;
        } else {
            if (store > unloadTarget) return unloadTarget - store;
        }
        return 0;
    };
    StructurePowerSpawn.prototype.getNeeds = function (resourceType) {
        // if parameter is enabled then autofill powerSpawns
        if (FILL_POWERSPAWN && !this.room.isCriticallyFortifyable) {
            if (resourceType === RESOURCE_ENERGY && this.energy < this.energyCapacity * 0.75) {
                return this.energyCapacity - this.energy;
            }
            if (resourceType === RESOURCE_POWER && this.power < this.powerCapacity * 0.25) {
                return this.powerCapacity - this.power;
            }
            return 0;
        }
        if (!this.room.memory.resources || !this.room.memory.resources.powerSpawn) return 0;
        let loadTarget = 0;
        let unloadTarget = 0;

        // look up resource and calculate needs
        let containerData = this.room.memory.resources.powerSpawn.find((s) => s.id === this.id);
        if (containerData) {
            let order = containerData.orders.find((o)=> {
                return o.type === resourceType;
            });
            if (order) {
                let amt = 0;
                if (resourceType === RESOURCE_ENERGY) amt = this.energy;
                else if (resourceType === RESOURCE_POWER) amt = this.power;
                loadTarget = Math.max(order.orderRemaining + amt, order.storeAmount);
                unloadTarget = order.orderAmount + order.storeAmount;
                if (unloadTarget < 0) unloadTarget = 0;
            }
        }
        let store = 0;
        let space = 0;
        if (resourceType === RESOURCE_ENERGY) {
            store = this.energy;
            space = this.energyCapacity - this.energy;
        } else if (resourceType === RESOURCE_POWER) {
            store = this.power;
            space = this.powerCapacity - this.power;
        }
        if (store < loadTarget) return Math.min(loadTarget - store, space);
        if (store > unloadTarget * 1.05) return unloadTarget - store;
        return 0;
    };

};

module.exports = mod;
