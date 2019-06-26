"use strict";

// save original API functions
let find = Room.prototype.find;

let mod = {};
module.exports = mod;
mod.extend = function () {

    // run extend in each of our room submodules
    for (let key of Object.keys(Room._ext))
        if (Room._ext[key].extend)
            Room._ext[key].extend();


    Room.prototype.checkRCL = function () {
        if (!this.controller) return;
        if (this.memory.RCL !== this.controller.level) {
            Room.RCLChange.trigger(this);
            this.memory.RCL = this.controller.level;
        }
    };

    Room.prototype.checkNuked = function () {
        if (!this.nuked)
            return false;
        else {
            Room.nuked.trigger(this);
        }
    };

    Room.prototype.countMySites = function () {
        const numSites = _.size(this.myConstructionSites);
        if (!_.isUndefined(this.memory.myTotalSites) && numSites !== this.memory.myTotalSites) {
            Room.costMatrixInvalid.trigger(this);
        }
        if (numSites > 0) this.memory.myTotalSites = numSites;
        else delete this.memory.myTotalSites;
    };

    Room.prototype.getBorder = function (roomName) {
        return _.findKey(Game.map.describeExits(this.name), function (name) {
            return this.name === name;
        }, {name: roomName});
    };

    Room.prototype.countMyStructures = function () {
        const numStructures = _.size(this.structures.my);
        if (!_.isUndefined(this.memory.myTotalStructures) && numStructures !== this.memory.myTotalStructures) {
            Room.costMatrixInvalid.trigger(this);
            // these are vital for feeding
            this.saveExtensions();
            this.saveSpawns();
        } else delete this.memory.myTotalStructures;
    };

    Room.prototype.getBorder = function (roomName) {
        return _.findKey(Game.map.describeExits(this.name), function (name) {
            return this.name === name;
        }, {name: roomName});
    };

    Room.prototype.find = function (c, opt) {
        if (_.isArray(c)) {
            return _(c)
                .map(x => find.call(this, x, opt))
                .flatten()
                .value();
        } else
            return find.apply(this, arguments);
    };

    Room.prototype.findRoute = function (destination, checkOwner = true, preferHighway = true, allowSK = true) {
        if (this.name == destination) return [];
        const options = {checkOwner, preferHighway, allowSK};
        return Game.map.findRoute(this, destination, {
            routeCallback: Room.routeCallback(this.name, destination, options)
        });
    };

    Room.prototype.recordMove = function (creep) {
        if (!ROAD_CONSTRUCTION_ENABLE &&
            (!ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name] ||
                (ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name] &&
                    ROAD_CONSTRUCTION_FORCED_ROOMS[Game.shard.name].indexOf(this.name) == -1))) return;
        let x = creep.pos.x;
        let y = creep.pos.y;
        if (x == 0 || y == 0 || x == 49 || y == 49 ||
            creep.carry.energy == 0 || creep.data.actionName == 'building')
            return;

        let key = `${String.fromCharCode(32 + x)}${String.fromCharCode(32 + y)}_x${x}-y${y}`;
        if (!this.roadConstructionTrace[key])
            this.roadConstructionTrace[key] = 1;
        else this.roadConstructionTrace[key]++;
    };

    Room.prototype.isWalkable = function (x, y, look) {
        if (!look) look = this.lookAt(x, y);
        else look = look[y][x];
        let invalidObject = o => {
            return ((o.type == LOOK_TERRAIN && o.terrain == 'wall') ||
                OBSTACLE_OBJECT_TYPES.includes(o[o.type].structureType));
        };
        return look.filter(invalidObject).length == 0;
    };

    Room.prototype.exits = function (findExit, point) {
        if (point === true) point = 0.5;
        let positions;
        if (findExit === 0) {
            // portals
            positions = _.chain(this.find(FIND_STRUCTURES)).filter(function (s) {
                return s.structureType === STRUCTURE_PORTAL;
            }).map('pos').value();
        } else {
            positions = this.find(findExit);
        }

        // assuming in-order
        let maxX, maxY;
        let map = {};
        let limit = -1;
        const ret = [];
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            if (!(_.get(map, [pos.x - 1, pos.y]) || _.get(map, [pos.x, pos.y - 1]))) {
                if (point && limit !== -1) {
                    ret[limit].x += Math.ceil(point * (maxX - ret[limit].x));
                    ret[limit].y += Math.ceil(point * (maxY - ret[limit].y));
                }
                limit++;
                ret[limit] = _.pick(pos, ['x', 'y']);
                maxX = pos.x;
                maxY = pos.y;
                map = {};
            }
            _.set(map, [pos.x, pos.y], true);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
        }
        if (point && limit !== -1) {
            ret[limit].x += Math.ceil(point * (maxX - ret[limit].x));
            ret[limit].y += Math.ceil(point * (maxY - ret[limit].y));
        }
        return ret;
    }

    Room.prototype.showCostMatrix = function (matrix = this.structureMatrix, aroundPos) {
        const vis = new RoomVisual(this.name);
        let startY = 0;
        let endY = 50;
        let startX = 0;
        let endX = 50;
        if (aroundPos) {
            startY = Math.max(0, aroundPos.y - 3);
            endY = Math.min(50, aroundPos.y + 4);
            startX = Math.max(0, aroundPos.x - 3);
            endX = Math.min(50, aroundPos.x + 4);
        }
        const maxCost = _.max(matrix._bits);
        const getColourByPercentage = (value) => {
            const hue = ((1 - value) * 120).toString(10);
            return `hsl(${hue}, 100%, 50%)`;
        };
        for (var y = startY; y < endY; y++) {
            for (var x = startX; x < endX; x++) {
                const cost = matrix.get(x, y);
                if (cost) vis.text(cost, x, y);
                vis.rect(x - 0.5, y - 0.5, 1, 1, {fill: getColourByPercentage(cost / maxCost)});
            }
        }
    };

    // toAvoid - a list of creeps to avoid sorted by owner
    Room.prototype.getAvoidMatrix = function (toAvoid) {
        const avoidMatrix = this.structureMatrix.clone();
        for (const owner in toAvoid) {
            const creeps = toAvoid[owner];
            for (const creep of creeps) {
                for (let x = Math.max(0, creep.pos.x - 3); x <= Math.min(49, creep.pos.x + 3); x++) {
                    const deltaX = x < creep.pos.x ? creep.pos.x - x : x - creep.pos.x;
                    for (let y = Math.max(0, creep.pos.y - 3); y <= Math.min(49, creep.pos.y + 3); y++) {
                        if (this.isWalkable(x, y)) {
                            const deltaY = y < creep.pos.y ? creep.pos.y - y : y - creep.pos.y;
                            const cost = 17 - (2 * Math.max(deltaX, deltaY));
                            avoidMatrix.set(x, y, cost) // make it less desirable than a swamp
                        }
                    }
                }
            }
        }
        return avoidMatrix;
    };

    Room.prototype.invalidateCostMatrix = function () {
        Room.costMatrixInvalid.trigger(this.name);
    };

    Room.prototype.highwayHasWalls = function () {
        if (!Room.isHighwayRoom(this.name)) return false;
        return !!_.find(this.getPositionAt(25, 25).lookFor(LOOK_STRUCTURES), s => s instanceof StructureWall);
    };

    Room.prototype.isTargetAccessible = function (object, target) {
        if (!object || !target) return;
        // Checks. Accept RoomObject, RoomPosition, and mock position
        if (object instanceof RoomObject) object = object.pos;
        if (target instanceof RoomObject) target = target.pos;
        for (const prop of ['x', 'y', 'roomName']) {
            if (!Reflect.has(object, prop) || !Reflect.has(target, prop)) return;
        }

        if (!Room.isHighwayRoom(this.name)) return;
        if (!this.highwayHasWalls()) return true;

        const [x, y] = Room.calcCoordinates(this.name, (x, y) => [x, y]);

        const getVerHalf = o => Math.floor(o.x / 25) === 0 ? LEFT : RIGHT;

        const getHorHalf = o => Math.floor(o.y / 25) === 0 ? TOP : BOTTOM;

        const getQuadrant = o => {
            const verHalf = getVerHalf(o);
            const horHalf = getHorHalf(o);
            if (verHalf === LEFT) {
                return horHalf === TOP ? TOP_LEFT : BOTTOM_LEFT;
            } else {
                return horHalf === TOP ? TOP_RIGHT : BOTTOM_RIGHT;
            }
        };
        if (x % 10 === 0) {
            if (y % 10 === 0) { // corner room
                const top = !!_.find(this.getPositionAt(25, 24).lookFor(LOOK_STRUCTURES), s => s instanceof StructureWall);
                const left = !!_.find(this.getPositionAt(24, 25).lookFor(LOOK_STRUCTURES, s => s instanceof StructureWall));
                const bottom = !!_.find(this.getPositionAt(25, 26).lookFor(LOOK_STRUCTURES, s => s instanceof StructureWall));
                const right = !!_.find(this.getPositionAt(26, 25).lookFor(LOOK_STRUCTURES, s => s instanceof StructureWall));
                // both in same quadrant
                if (getQuadrant(object) === getQuadrant(target)) return true;

                if (top && left && bottom && right) {
                    // https://i.imgur.com/8lmqtbi.png
                    return getQuadrant(object) === getQuadrant(target);
                }

                if (top) {
                    if (bottom) {
                        // cross section
                        if (left) {
                            return Util.areEqual(RIGHT, getVerHalf(object), getVerHalf(target));
                        } else {
                            return Util.areEqual(LEFT, getVerHalf(object), getVerHalf(target));
                        }
                    }
                    if (left && right) {
                        // cross section
                        if (getHorHalf(object) !== getHorHalf(target)) return false;
                        return Util.areEqual(BOTTOM, getHorHalf(object), getHorHalf(target));
                    }
                    if (Util.areEqual(BOTTOM, getHorHalf(object), getHorHalf(target))) return true;
                    if (left) {
                        if (Util.areEqual(RIGHT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === TOP_LEFT && getQuadrant(target) !== TOP_LEFT) return false;
                    } else {
                        if (Util.areEqual(LEFT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === TOP_RIGHT && getQuadrant(target) !== TOP_RIGHT) return false;
                    }
                } else {
                    if (left && right) {
                        // cross section
                        if (getHorHalf(object) !== getHorHalf(target)) return false;
                        return Util.areEqual(TOP, getHorHalf(object), getHorHalf(target));
                    }
                    if (Util.areEqual(TOP, getHorHalf(object), getHorHalf(target))) return true;
                    if (left) {
                        if (Util.areEqual(RIGHT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === BOTTOM_LEFT && getQuadrant(target) !== BOTTOM_LEFT) return false;
                    } else {
                        if (Util.areEqual(LEFT, getVerHalf(object), getVerHalf(target))) return true;
                        if (getQuadrant(object) === BOTTOM_RIGHT && getQuadrant(target) !== BOTTOM_RIGHT) return false;
                    }
                }
                return true;
            }
            if (getVerHalf(object) === getVerHalf(target)) return true;
        }
        if (y % 10 === 0) {
            if (getHorHalf(object) === getHorHalf(target)) return true;
        }
        return true;
    };

    Room.prototype.targetAccessible = function (target) {
        if (!target) return;
        if (target instanceof RoomObject) target = target.pos;
        for (const prop of ['x', 'y', 'roomName']) {
            if (!Reflect.has(target, prop)) return;
        }
        if (!Room.isHighwayRoom(this.name)) return;
        if (!this.highwayHasWalls()) return true;

        const closestRoom = _(Game.rooms).filter('my').min(r => Game.map.getRoomLinearDistance(r.name, this.name));
        if (closestRoom === Infinity) return;

        const [x1, y1] = Room.calcGlobalCoordinates(this.name, (x, y) => [x, y]);
        const [x2, y2] = Room.calcGlobalCoordinates(closestRoom, (x, y) => [x, y]);
        let dir = '';
        if (y1 - y2 < 0) {
            dir += 'south';
        } else if (y1 - y2 > 0) {
            dir += 'north';
        }
        if (x1 - x2 < 0) {
            dir += 'east';
        } else if (x1 - x2 > 0) {
            dir += 'west';
        }
        if (x1 % 10 === 0) {
            if (y1 % 10 === 0) {
                // corner room
                if (dir.includes('south') && dir.includes('east')) {
                    return this.isTargetAccessible(this.getPositionAt(49, 49), target);
                }
                if (dir.includes('south') && dir.includes('west')) {
                    return this.isTargetAccessible(this.getPositionAt(0, 49), target);
                }
                if (dir.includes('north') && dir.includes('east')) {
                    return this.isTargetAccessible(this.getPositionAt(49, 0), target);
                }
                if (dir.includes('north') && dir.includes('west')) {
                    return this.isTargetAccessible(this.getPositionAt(0, 0), target);
                }
            }
            if (dir.includes('east')) {
                return this.isTargetAccessible(this.getPositionAt(49, 25), target);
            }
        }
        if (y1 % 10 === 0) {
            if (dir.includes('south')) {
                return this.isTargetAccessible(this.getPositionAt(25, 49), target);
            }
            if (dir.includes('north')) {
                return this.isTargetAccessible(this.getPositionAt(25, 0), target);
            }
        }
        return true;
    };

    Room.prototype.getCreepMatrix = function (structureMatrix = this.structureMatrix) {
        if (_.isUndefined(this._creepMatrix)) {
            const costs = structureMatrix.clone();
            // Avoid creeps in the room
            this.allCreeps.forEach(function (creep) {
                costs.set(creep.pos.x, creep.pos.y, 0xff);
            });
            this._creepMatrix = costs;
        }
        return this._creepMatrix;
    };

    Room.prototype.GCOrders = function () {

        let data = this.memory.resources,
            myRooms = _.filter(Game.rooms, {'my': true});

        if (_.isUndefined(data)) {
            if (global.DEBUG)
                global.logSystem(this.name, `there is no ${this.name}.memory.resources.`);
            return;
        }

        if (data.orders.length === 0)
            return;

        if (global.DEBUG)
            global.logSystem(this.name, `garbage collecting ${this.name} roomOrders`);

        let reactions = data.reactions,
            reactionInProgress = reactions ? reactions.orders.length > 0 && reactions.orders[0].amount > 0 : false;

        // garbage collecting room.orders
        if (reactionInProgress) {

            let reactionsOrders = reactions.orders[0],
                componentA = global.LAB_REACTIONS[reactionsOrders.type][0],
                componentB = global.LAB_REACTIONS[reactionsOrders.type][1];

            data.orders = _.filter(data.orders, order => {
                return order.amount > 0 && (order.type === componentA || order.type === componentB || (!_.isUndefined(global.COMPOUNDS_TO_ALLOCATE[order.type]) && global.COMPOUNDS_TO_ALLOCATE[order.type].allocate));
            });
        } else {
            data.orders = _.filter(data.orders, order => {
                return order.amount > 0 && !_.isUndefined(global.COMPOUNDS_TO_ALLOCATE[order.type]) && global.COMPOUNDS_TO_ALLOCATE[order.type].allocate;
            });
        }

        // TODO it can be passed by a parameter or needed? (called from fillARoomOrder, room.lab and?)
        if (!this.allOrdersWithOffers()) {

            if (global.DEBUG) {
                global.logSystem(this.name, `not enough or no offers found. Updating room orders in room ${this.name}`);
            }
            if (_.isUndefined(data.boostTiming.getOfferAttempts))
                data.boostTiming.getOfferAttempts = 0;
            else
                data.boostTiming.getOfferAttempts++;

            // GCAllRoomOffers
            global.logSystem(this.name, `${this.name} running GCAllRoomOffers`);

            for (let room of myRooms) {

                let data = room.memory.resources;

                if (_.isUndefined(data) || _.isUndefined(room.terminal))
                    continue;

                if (_.isUndefined(room.memory.resources.terminal) || room.memory.resources.terminal.length === 0) {
                    room.memory.resources.terminal = [];
                    room.memory.resources.terminal.push({
                            id: room.terminal.id,
                            orders: []
                        }
                    )
                }

                data.terminal[0].orders = [];
                data.offers = [];
            }

            if (data.boostTiming.getOfferAttempts < 3) {
                this.updateRoomOrders();
                //data.boostTiming.ordersPlaced = Game.time;
                data.boostTiming.checkRoomAt = Game.time + 1;
                return true;
            } else {
                data.orders = [];
                if (data.reactions.orders[0])
                    data.reactions.orders[0].amount = 0;
                delete data.boostTiming.getOfferAttempts;
                global.logSystem(this.name, `${this.name} no offers found. Reaction and orders DELETED`);
            }
        } else {
            data.boostTiming.checkRoomAt = Game.time + global.CHECK_ORDERS_INTERVAL;
            return false;
        }


    };

    Room.prototype.GCOffers = function () {

        let data = this.memory.resources,
            terminalOrderPlaced = false,
            readyOffersFound = 0;

        if (_.isUndefined(data)) {
            if (global.DEBUG)
                global.logSystem(this.name, `there is no ${this.name}.memory.resources.`);
            return {
                readyOffersFound: readyOffersFound,
                terminalOrderPlaced: terminalOrderPlaced
            };
        }

        if (data.offers.length === 0)
            return {
                readyOffersFound: readyOffersFound,
                terminalOrderPlaced: terminalOrderPlaced
            };

        if (global.DEBUG)
            global.logSystem(this.name, `garbage collecting ${this.name} roomOffers`);

        // garbage collecting room.offers
        data.offers = _.filter(data.offers, offer => {

            let orderRoom = Game.rooms[offer.room],
                orderRoomOrders = orderRoom.memory.resources.orders,
                resourcesAll = this.resourcesAll[offer.type];

            for (let i = 0; i < orderRoomOrders.length; i++) {

                let order = orderRoomOrders[i];

                if (offer.id === order.id && !_.isUndefined(resourcesAll) && resourcesAll >= 0)
                    return true;
                else if (offer.id === order.id) {
                    orderRoom.memory.resources.orders[i].offers = [];
                    return false;
                }
            }
            return false;

        });


        // checking terminal orders
        if (data.offers.length > 0) {

            for (let offer of data.offers) {

                let readyAmount = this.terminal.store[offer.type] || 0;

                global.logSystem(this.name, `${readyAmount} / ${offer.amount} ${offer.type} are in ${this.name} terminal`);

                if ((readyAmount >= global.MIN_OFFER_AMOUNT && readyAmount <= offer.amount - global.MIN_OFFER_AMOUNT) || readyAmount >= offer.amount) {
                    if (global.DEBUG)
                        global.logSystem(offer.room, `${Math.min(readyAmount, offer.amount)} ${offer.type} are ready to send from ${this.name}`);
                    readyOffersFound++;
                } else {
                    // make order in offerRoom terminal

                    if (this.memory.resources.terminal.length === 0)
                        this.memory.resources.terminal.push({
                            id: this.terminal.id,
                            orders: []
                        });

                    if (this.memory.resources.storage.length === 0)
                        this.memory.resources.storage.push({
                            id: this.storage.id,
                            orders: []
                        });

                    let terminalMemory = this.memory.resources.terminal[0],
                        terminalId = this.memory.resources.terminal[0].id,
                        terminal = this.terminal;

                    // TODO is it necessary?
                    // garbage collecting offerRoom terminal orders
                    /*

                    if (terminalMemory.orders.length > 0) {
                        terminalMemory.orders = _.filter(terminalMemory.orders, order => {

                            return (_.some(data.offers, offer => {
                                        return (offer.type === order.type && offer.amount === order.orderRemaining + (terminal.store[offer.type] || 0));
                                        })
                                    || (order.type === this.mineralType && this.storage.store[order.type] >= global.MAX_STORAGE_MINERAL)
                                    || (order.type.length === 1 && order.type !== this.mineralType && order.type !== RESOURCE_ENERGY && this.storage.store[order.type] >= global.MAX_STORAGE_NOT_ROOM_MINERAL)
                                    || (global.SELL_COMPOUND[order.type] && global.SELL_COMPOUND[order.type].sell
                                        && (global.SELL_COMPOUND[order.type].rooms.length === 0 || _.some(global.SELL_COMPOUND[mineral], {'rooms': this.name})))
                                );
                        });
                    }

                    */

                    // making terminal orders if it does not exist
                    let ordered = global.sumCompoundType(terminalMemory.orders, 'orderRemaining'),
                        allResources = (ordered[offer.type] || 0) + (terminal.store[offer.type] || 0);
                    if (offer.amount > allResources) {
                        if (global.DEBUG) {
                            global.logSystem(this.name, `no / not enough terminal order found in ${this.name} for ${offer.amount} ${offer.type}`);
                            global.logSystem(this.name, `terminal stores: ${terminal.store[offer.type] || 0} ordered: ${ordered[offer.type] || 0}`);
                            global.logSystem(this.name, `terminal order placed for ${Math.max(offer.amount, global.MIN_OFFER_AMOUNT)} ${offer.type}`);

                        }
                        this.placeOrder(terminalId, offer.type, Math.max(offer.amount, global.MIN_OFFER_AMOUNT));
                        terminalOrderPlaced = true;
                    } else
                        global.logSystem(this.name, `${this.name} terminal orders for ${offer.amount} ${offer.type} is OK.`);

                }
            }
        }
        return {
            readyOffersFound: readyOffersFound,
            terminalOrderPlaced: terminalOrderPlaced
        };
    };

    Room.prototype.GCLabs = function () {

        if (global.DEBUG)
            global.logSystem(this.name, `garbage collecting labOrders in ${this.name}`);

        let data = this.memory.resources,
            labs = data.lab,
            reactions = data.reactions,
            reactionsOrders = reactions.orders[0];

        for (let i = 0; i < labs.length; i++) {

            let lab = labs[i],
                order;

            if (lab.orders.length > 0) {

                if (data.reactions.orders.length > 0) {

                    let componentA = global.LAB_REACTIONS[reactionsOrders.type][0],
                        componentB = global.LAB_REACTIONS[reactionsOrders.type][1];

                    order = _.filter(lab.orders, liveOrder => {
                        if ((liveOrder.orderAmount > 0 || liveOrder.orderRemaining > 0 || liveOrder.storeAmount > 0)
                            && (liveOrder.type === componentA || liveOrder.type === componentB || liveOrder.type === 'energy'
                                || lab.reactionState === 'Storage'))

                            return liveOrder;
                    });
                } else {

                    order = _.filter(lab.orders, liveOrder => {
                        if (liveOrder.type === 'energy' || lab.reactionState === 'Storage')
                            return liveOrder;
                    });

                }

                if (lab.orders.length > order.length) {
                    this.memory.resources.lab[i].orders = order;
                    if (global.DEBUG)
                        global.logSystem(this.name, `lab orders fixed in ${this.name}, ${lab.id}`);
                }
            }
        }
    };

    Room.prototype.checkOffers = function () {


        if (Memory.boostTiming.multiOrderingRoomName === this) {
            global.logSystem(this.name, `${this.name} early roomCheck, multiOrdering in progress`);
            return true;
        }

        let data = this.memory.resources,
            orders = data.orders,
            candidates = [],
            testedRooms = [],
            terminalOrderPlaced = false,
            returnValue;

        for (let order of orders) {
            if (order.offers.length > 0) {
                for (let offer of order.offers) {
                    let roomTested = _.some(testedRooms, testedRoom => {
                        return testedRoom === offer.room;
                    });

                    if (!roomTested) {
                        let offerRoom = Game.rooms[offer.room];
                        returnValue = offerRoom.GCOffers();

                        if (returnValue.terminalOrderPlaced)
                            terminalOrderPlaced = true;

                        if (returnValue.readyOffersFound > 0) {
                            candidates.push({
                                room: offer.room,
                                readyOffers: returnValue.readyOffersFound
                            });
                        }
                        testedRooms.push(offer.room);
                    }
                }
            }
        }

        if (candidates.length === 1 && candidates[0].readyOffers === 1 && _.isUndefined(data.boostTiming.ordersReady)) {
            let currentRoom = Game.rooms[candidates[0].room];
            global.logSystem(this.name, `${candidates[0].room} there is only one offersReady for ${this.name}, running fillARoomOrder()`);
            let fillARoomOrdersReturn = false;
            if (currentRoom.terminal.cooldown === 0) {
                fillARoomOrdersReturn = currentRoom.fillARoomOrder();
                if (fillARoomOrdersReturn === true && data.orders.length === 0 || _.sum(data.orders, 'amount') <= 0) {
                    data.boostTiming.checkRoomAt = Game.time + 1;
                    global.logSystem(currentRoom.name, `${currentRoom.name} terminal send was successful. And there are no more orders`);
                    delete data.boostTiming.getOfferAttempts;
                    return true;
                } else if (fillARoomOrdersReturn === true) {
                    data.boostTiming.checkRoomAt = Game.time + global.CHECK_ORDERS_INTERVAL;
                    delete data.boostTiming.getOfferAttempts;
                    global.logSystem(currentRoom.name, `${currentRoom.name} terminal send was successful. BTW, there are orders remained to fulfill`);
                    return true;
                }
            } else {
                data.boostTiming.checkRoomAt = Game.time + currentRoom.terminal.cooldown + 1;
                global.logSystem(currentRoom.name, `${currentRoom.name} terminal cooldown is: ${currentRoom.terminal.cooldown}`);
                return false;
            }
        } else if ((candidates.length >= 1 || (candidates.length === 1 && candidates[0].readyOffers > 1)) && _.isUndefined(data.boostTiming.ordersReady)) {
            global.logSystem(this.name, `${this.name} has more than one offers ready, boostTiming.ordersReady created`);
            global.BB(candidates);
            data.boostTiming.ordersReady = {
                time: Game.time,
                orderCandidates: candidates
            };
            if (!Memory.boostTiming)
                Memory.boostTiming = {};
            Memory.boostTiming.multiOrderingRoomName = this.name;
            data.boostTiming.checkRoomAt = Game.time + _.sum(candidates, 'readyOffers') + 1;
            return true;
        } else if (terminalOrderPlaced) {
            //global.logSystem(this.name, `terminal orders placed for room ${this.name}`);
            data.boostTiming.checkRoomAt = Game.time + global.CHECK_ORDERS_INTERVAL;
            return false;
        } else {
            global.logSystem(this.name, `${this.name} no readyOffers found`);
            data.boostTiming.checkRoomAt = Game.time + global.CHECK_ORDERS_INTERVAL;
            return false;
        }


    };

    Room.prototype.allOrdersWithOffers = function () {
        let orders = this.memory.resources.orders;
        if (orders.length === 0)
            return false;
        let ordersDone = _.filter(orders, order => {
            let orderOffersAmount = _.sum(order.offers, 'amount') || 0;
            return orderOffersAmount >= order.amount;
        });
        return ordersDone.length === orders.length;
    };

    Room.prototype.ordersWithOffers = function () {
        let orders = this.memory.resources.orders;
        if (orders.length === 0)
            return false;
        return _.some(orders, order => {
            let orderOffersAmount = _.sum(order.offers, 'amount') || 0;
            return orderOffersAmount >= order.amount && order.amount > 0;
        });
    };

    Room.prototype.makeReaction = function () {

        if (this.nuked)
            return;

        let roomFound = false,
            amountToMake,
            makeCompound = function (roomName, compound, amount) {

                let currentRoom = Game.rooms[roomName];

                if (_.isUndefined(currentRoom.memory.resources))
                    return false;

                if (_.isUndefined(currentRoom.memory.resources.reactions))
                    return false;

                if (currentRoom.memory.resources.reactions.reactorMode !== 'idle')
                    return false;

                if (currentRoom.memory.labs) {
                    if (currentRoom.memory.labs.length < 3)
                        return false;
                    else if (currentRoom.memory.labs.length === 3 && !global.MAKE_REACTIONS_WITH_3LABS)
                        return false;
                } else
                    return false;

                if (!currentRoom.storage || !currentRoom.terminal) {
                    if (global.DEBUG)
                        console.log(`there are no storage/terminal in ${currentRoom.name}`);
                    return false;
                }

                if (currentRoom.terminal.isActive() === false || currentRoom.storage.isActive() === false || Game.getObjectById(currentRoom.memory.labs[0].id).isActive() === false)
                    return false;

                let data = currentRoom.memory.resources.reactions,
                    whatNeeds = function (compound, amount) {

                        if (compound.length === 1 && compound !== 'G')
                            return;

                        let sumStorage = function (mineral) {

                                let myRooms = _.filter(Game.rooms, (room) => {
                                        return room.my && room.storage && room.terminal;
                                    }),
                                    roomStored = 0;

                                for (let room of myRooms) {

                                    let resourcesAll = room.resourcesAll[mineral] || 0;
                                    if (global.COMPOUNDS_TO_ALLOCATE[mineral] && global.COMPOUNDS_TO_ALLOCATE[mineral].allocate)
                                        resourcesAll -= global.COMPOUNDS_TO_ALLOCATE[mineral].amount + global.COMPOUNDS_TO_ALLOCATE[mineral].roomThreshold;
                                    if (resourcesAll >= global.MIN_OFFER_AMOUNT)
                                        roomStored += resourcesAll;
                                }

                                return roomStored;
                            },
                            ingredientNeeds = function (compound, amount) {
                                // this amount has to be produced in this room
                                let storedAll = sumStorage(compound),
                                    storedRoom = (currentRoom.resourcesAll[compound] || 0) - (!_.isUndefined(global.COMPOUNDS_TO_ALLOCATE[compound]) && global.COMPOUNDS_TO_ALLOCATE[compound].allocate ?
                                        global.COMPOUNDS_TO_ALLOCATE[compound].amount + global.COMPOUNDS_TO_ALLOCATE[compound].roomThreshold : 0),
                                    storedOffRoom = storedAll - storedRoom,
                                    ingredientNeeds;

                                if (storedOffRoom < global.TRADE_THRESHOLD) {
                                    ingredientNeeds = amount - storedRoom;
                                    if (ingredientNeeds < 0)
                                        ingredientNeeds = 0;
                                    else if (ingredientNeeds < global.MIN_COMPOUND_AMOUNT_TO_MAKE)
                                        ingredientNeeds = global.MIN_COMPOUND_AMOUNT_TO_MAKE;
                                } else {
                                    ingredientNeeds = amount - storedAll;
                                    if (ingredientNeeds < 0)
                                        ingredientNeeds = 0;
                                    else if (ingredientNeeds < global.MIN_COMPOUND_AMOUNT_TO_MAKE)
                                        ingredientNeeds = global.MIN_COMPOUND_AMOUNT_TO_MAKE;
                                }

                                return global.roundUpTo(ingredientNeeds, global.MIN_OFFER_AMOUNT);
                            },
                            findIngredients = function (compound, amount) {

                                let ingredientA = (global.LAB_REACTIONS[compound][0]),
                                    ingredientB = (global.LAB_REACTIONS[compound][1]);

                                return {
                                    [ingredientA]: ingredientNeeds(ingredientA, amount),
                                    [ingredientB]: ingredientNeeds(ingredientB, amount)
                                };
                            },
                            slicer = function (compound, amount) {

                                let product = {},
                                    returnValue = {},
                                    slice = function (stuff) {
                                        if (Object.keys(stuff).length === 0)
                                            return false;
                                        else
                                            return stuff;
                                    };

                                product[compound] = findIngredients(compound, amount);
                                Object.keys(product).forEach(ingredients => {
                                    Object.keys(product[ingredients]).forEach(ingredient => {

                                        if (ingredient.length > 1 || ingredient === 'G')
                                            returnValue[ingredient] = product[ingredients][ingredient];

                                    });
                                });

                                return {
                                    product: product,
                                    slice: slice(returnValue)
                                };
                            },
                            returnObject = slicer(compound, amount),
                            product = returnObject.product,
                            slices = returnObject.slice;

                        do {

                            let returnArray = [];

                            Object.keys(slices).forEach(slice => {
                                returnObject = slicer(slice, slices[slice]);
                                product[slice] = returnObject.product[slice];
                                returnArray.push(returnObject.slice);
                            });
                            slices = {};
                            for (let slice of returnArray)
                                slices = Object.assign(slices, slice);

                        } while (_.some(slices, Object));

                        return product;
                    },
                    mineralPurchased = false,
                    ingredientMade = false,
                    purchaseMinerals = function (roomName, mineral, amount) {

                        if (mineralPurchased)
                            return false;

                        if (!global.PURCHASE_MINERALS) {
                            if (global.DEBUG)
                                console.log(`${roomName} needs to buy ${amount} ${mineral} but PURCHASE_MINERALS is false`);
                            return false;
                        }

                        if (currentRoom.storage.charge < global.STORE_CHARGE_PURCHASE) {
                            if (global.DEBUG)
                                console.log(`storage.charge in ${roomName} is ${currentRoom.storage.charge}, purchase for ${mineral} is delayed`);
                            return false;
                        }

                        if (currentRoom.terminal.cooldown > 0) {
                            if (global.DEBUG)
                                console.log(`terminal.coolDown in ${roomName} is ${currentRoom.terminal.cooldown}, purchase for ${mineral} is delayed`);
                            return false;
                        }

                        if (global.DEBUG)
                            console.log(`buying ${amount} ${mineral} in ${roomName}`);

                        let order,
                            returnValue,
                            allOrders = global._sellOrders(mineral),
                            resOrders = _.filter(allOrders, o => {

                                let currentRoom = Game.rooms[roomName],
                                    transactionCost,
                                    credits;

                                o.transactionAmount = Math.min(o.amount, amount);

                                transactionCost = Game.market.calcTransactionCost(o.transactionAmount, o.roomName, roomName);

                                if (transactionCost > currentRoom.terminal.store[RESOURCE_ENERGY])
                                    return false;

                                credits = o.transactionAmount * o.price;

                                if (Game.market.credits < credits) {
                                    o.transactionAmount = Game.market.credits / o.price;
                                    if (o.transactionAmount === 0) return false;
                                }
                                o.ratio = (credits + (transactionCost * global.ENERGY_VALUE_CREDITS)) / o.transactionAmount;

                                return o.amount > 100;
                            });

                        if (resOrders.length > 0) {

                            order = _.min(resOrders, 'ratio');
                            console.log('selected order: ');
                            global.BB(order);

                            if (order) {

                                global.logSystem(roomName, `Game.market.deal("${order.id}", ${order.transactionAmount}, "${roomName}");`);
                                returnValue = Game.market.deal(order.id, order.transactionAmount, roomName);

                                if (returnValue === OK && order.transactionAmount === amount) {
                                    global.logSystem(roomName, `Purchased ${order.transactionAmount} ${mineral} at price: ${order.price} it costs: ${order.transactionAmount * order.price}`);
                                    return true;
                                } else if (returnValue === OK) {
                                    global.logSystem(roomName, `Purchased ${order.transactionAmount} ${mineral} at price: ${order.price} it costs: ${order.transactionAmount * order.price}`);
                                    global.logSystem(roomName, `${amount - order.transactionAmount} ${mineral}, left for buying`);
                                    return false;
                                } else {
                                    global.logSystem(roomName, `purchase was FAILED error code: ${global.translateErrorCode(returnValue)}`);
                                    console.log(returnValue);
                                    return false;
                                }
                            } else
                                return false;

                        } else {
                            console.log(`No sell order found for ${amount} ${mineral} at ratio ${global.MAX_BUY_RATIO[mineral]} in room ${roomName}`);
                            console.log(`You need to adjust MAX_BUY_RATIO or use AUTOMATED_RATIO_COUNT: true in parameters, current is: ${global.MAX_BUY_RATIO[mineral]}, recommended: ${sellRatio}`);

                            return false;
                        }
                    },
                    makeIngredient = function (roomName, ingredient, amount) {

                        if (_.isUndefined(data)) {
                            if (global.DEBUG)
                                console.log(`labs in room ${roomName} are not registered as flower`);
                            return false;
                        } else if (data.reactorType !== 'flower') {
                            if (global.DEBUG)
                                console.log(`labs in room ${roomName} are not registered as flower`);
                            return false;
                        }

                        let currentRoom = Game.rooms[roomName];

                        if (global.DEBUG)
                            global.logSystem(roomName, `${currentRoom.name} - placeReactionOrder(${ingredient}, ${ingredient}, ${amount})`);

                        // garbage collecting labs
                        currentRoom.GCLabs();

                        // place the reaction order
                        currentRoom.placeReactionOrder(ingredient, ingredient, amount);

                        Memory.boostTiming.roomTrading.boostProduction = true;
                        Memory.boostTiming.timeStamp = Game.time;

                        let boostTiming = currentRoom.memory.resources.boostTiming;
                        boostTiming.roomState = 'reactionPlaced';
                        return true;
                    },
                    product = whatNeeds(compound, amount),
                    compoundArray = [],
                    currentCompound;

                for (let ingredients in product) {

                    for (let ingredient in product[ingredients]) {

                        let ingredientAmount = product[ingredients][ingredient];

                        if (ingredientAmount > 0 && !mineralPurchased) {

                            // purchase minerals if it can not be ordered
                            if (ingredient.length === 1 && ingredient !== 'G' && (currentRoom.resourcesAll[ingredient] || 0) < ingredientAmount && !mineralPurchased) {
                                mineralPurchased = purchaseMinerals(roomName, ingredient, ingredientAmount);
                                if (!mineralPurchased)
                                    global.logSystem(roomName, `tried to purchase minerals, but not found enough. Trying again in the next turn.`);
                                else
                                    global.logSystem(roomName, `purchase was successful`);
                                return true;
                            }
                            // if ingredient can make, collect the compounds
                            else if (ingredient.length > 1 || ingredient === 'G')
                                compoundArray.push({
                                    compound: ingredient,
                                    amount: ingredientAmount
                                });
                        }
                    }
                }

                // define tier 3 compound
                if (compoundArray.length === 0)
                    compoundArray.push({
                        compound: compound,
                        amount: amount
                    });
                // make the compound
                if (!mineralPurchased) {
                    currentCompound = compoundArray[compoundArray.length - 1];
                    ingredientMade = makeIngredient(roomName, currentCompound.compound, currentCompound.amount);
                    return ingredientMade;
                }
            };

        Object.keys(global.COMPOUNDS_TO_MAKE).forEach(compound => {

            if (global.COMPOUNDS_TO_MAKE[compound].make && !roomFound && (global.COMPOUNDS_TO_MAKE[compound].rooms.indexOf(this.name) > -1 || global.COMPOUNDS_TO_MAKE[compound].rooms.length === 0)) {

                let storedResources = (this.resourcesAll[compound] || 0);

                //global.logSystem(this.name, `start making ${compound} amount: ${storedResources}`);

                if (storedResources === 0) {
                    amountToMake = global.roundUpTo(global.COMPOUNDS_TO_MAKE[compound].amount + global.COMPOUNDS_TO_MAKE[compound].roomThreshold, global.MIN_OFFER_AMOUNT);
                    roomFound = makeCompound(this.name, compound, amountToMake);
                    if (roomFound && global.DEBUG)
                        global.logSystem(this.name, `there is no ${compound}, so try to make the compounds for ${global.COMPOUNDS_TO_MAKE[compound].amount} ${compound} in ${this.name}`);
                } else if (storedResources < global.COMPOUNDS_TO_MAKE[compound].roomThreshold) {
                    amountToMake = global.roundUpTo(global.COMPOUNDS_TO_MAKE[compound].amount + global.COMPOUNDS_TO_MAKE[compound].roomThreshold - storedResources, global.MIN_OFFER_AMOUNT);
                    roomFound = makeCompound(this.name, compound, amountToMake);
                    if (roomFound && global.DEBUG)
                        global.logSystem(this.name, `it is below the threshold, so try to make the compounds for ${amountToMake} ${compound} in ${this.name}`);
                }
            }
        });

        return roomFound;

    };

    Room.prototype.storedMinerals = function (mineral) {

        let returnValue = (this.resourcesStorage[mineral] || 0) + (this.resourcesTerminal[mineral] || 0) - (this.resourcesOffers[mineral] || 0) - (this.resourcesReactions[mineral] || 0);
        //if (returnValue < 0)
        //    returnValue = 0;
        return returnValue;
    };

    Room.prototype.countCheckRoomAt = function () {
        let data = this.memory.resources,
            boostTiming = data.boostTiming,
            numberOfLabs = data.lab.length,
            reactionCoolDown = REACTION_TIME[data.reactions.orders[0].type],
            producedAmountPerTick = LAB_REACTION_AMOUNT,
            storageLabs = this.structures.labs.storage,
            numberOfSlaveLabs = numberOfLabs - storageLabs.length - 2,
            allLabsProducedAmountPerTick = producedAmountPerTick * numberOfSlaveLabs / reactionCoolDown,
            amount = data.reactions.orders[0].amount;

        boostTiming.checkRoomAt = boostTiming.reactionMaking + global.roundUpTo(amount / allLabsProducedAmountPerTick, reactionCoolDown);
    };

    Room.prototype.getSeedLabOrders = function () {

        let data = this.memory.resources;

        if (_.isUndefined(data) || _.isUndefined(data.reactions) || data.reactions.orders.length === 0)
            return;

        let orderType = data.reactions.orders[0].type,
            component_a = global.LAB_REACTIONS[orderType][0],
            component_b = global.LAB_REACTIONS[orderType][1],
            labIndexA = data.lab.findIndex(l => {
                return l.id === data.reactions.seed_a;
            }),
            labIndexB = data.lab.findIndex(l => {
                return l.id === data.reactions.seed_b;
            }),
            labOrderA = _.filter(data.lab[labIndexA].orders, order => {
                return order.type === component_a;
            }),
            labOrderB = _.filter(data.lab[labIndexB].orders, order => {
                return order.type === component_b;
            }),
            labOrderAmountA = labOrderA[0].orderRemaining,
            labOrderAmountB = labOrderB[0].orderRemaining;

        return {
            labOrderAmountA: labOrderAmountA,
            labOrderAmountB: labOrderAmountB
        }

    };

    Room.prototype.allocateCompound = function (compounds, GUID, type, invadersRoom = false) {

        if (Object.keys(compounds).length === 0)
            return;

        let empireResources = function (compound) {

            let myRooms = _.filter(Game.rooms, room => {
                    return room.my && room.storage && room.terminal;
                }),
                roomStored = 0;

            for (let room of myRooms)
                roomStored += (room.resourcesStorage[compound] || 0);

            return roomStored;
        };


        for (let category in compounds) {

            let boosts = compounds[category];

            for (let boost of boosts) {

                console.log(`${category} ${boost}`);

                let availableCompound,
                    that = this,
                    compoundsToAllocate = Memory.compoundsToAllocate[boost],
                    alreadyAllocated = _.some(compoundsToAllocate.allocateRooms, room => {
                        return room === this.name;
                    }) && compoundsToAllocate.allocate && compoundsToAllocate.storeTo === 'lab';

                if (alreadyAllocated) {
                    global.logSystem(this.name, `${boost} is already Allocated`);
                    break;
                }


                if (compoundsToAllocate)
                    availableCompound = (this.resourcesStorage[boost] || 0) >= compoundsToAllocate.amount || empireResources(boost) >= compoundsToAllocate.amount;


                global.logSystem(this.name, `boost: ${boost} available: ${availableCompound}`);

                if (availableCompound) {

                    global.logSystem(this.name, `BOOSTS will allocated: ${boost} to: ${this.name}`);

                    Memory.compoundsToAllocate[boost].allocateRooms.push(this.name);

                    //TODO compoundsToAllocate.labRefilledAt = something etc can add

                    Memory.compoundsToAllocate[boost].allocate = true;
                    Memory.compoundsToAllocate[boost].storeTo = 'lab';

                    if (!Memory.allocateProperties.urgentAllocate.allocate)
                        Memory.allocateProperties.urgentAllocate.allocate = true;

                    if (!_.some(Memory.allocateProperties.urgentAllocate.allocateRooms, room => {
                        return room === that.name;
                    }))
                        Memory.allocateProperties.urgentAllocate.allocateRooms.push(that.name);

                    // create lastAllocated{}

                    if (_.isUndefined(Memory.allocateProperties.lastAllocated[GUID]))
                        if (type === 'defense') {
                        Memory.allocateProperties.lastAllocated[GUID] = {
                            type: type,
                            compounds: [],
                            allocateRooms: [],
                            invadedRooms: []
                        };
                    } else {
                        Memory.allocateProperties.lastAllocated[GUID] = {
                            type: type,
                            compounds: [],
                            allocateRooms: []
                        };
                    }

                    if (!_.some(Memory.allocateProperties.lastAllocated[GUID].compounds, compound => {
                        return compound === boost;
                    }))
                        Memory.allocateProperties.lastAllocated[GUID].compounds.push(boost);

                    if (!_.some(Memory.allocateProperties.lastAllocated[GUID].allocateRooms, room => {
                        return room === that.name;
                    }))
                        Memory.allocateProperties.lastAllocated[GUID].allocateRooms.push(that.name);

                    if (type === 'defense') {
                        if (!_.some(Memory.allocateProperties.lastAllocated[GUID].invadedRooms, room => {
                            return room === invadersRoom;
                        }))
                            Memory.allocateProperties.lastAllocated[GUID].invadedRooms.push(invadersRoom);
                    }

                    //global.BB(Memory.compoundsToAllocate[boost]);
                    //global.BB(Memory.allocateProperties.urgentAllocate);
                    //global.BB(Memory.allocateProperties.lastAllocated[GUID]);

                    break;
                }
            }
        }
    };

    // from room.spawn
    Room.prototype.saveSpawns = function () {
        let spawns = this.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            let id = o => o.id;
            this.memory.spawns = _.map(spawns, id);
        } else delete this.memory.spawns;
    };

    // from room.defense
    Room.prototype.processInvaders = function () {
        let that = this;
        if (this.memory.hostileIds === undefined)
            this.memory.hostileIds = [];
        if (!SEND_STATISTIC_REPORTS) delete this.memory.statistics;
        else if (this.memory.statistics === undefined) {
            this.memory.statistics = {};
        }

        let registerHostile = creep => {
            if (Room.isCenterNineRoom(this.name)) return;
            // if invader id unregistered
            if (!that.memory.hostileIds.includes(creep.id)) {
                // handle new invader
                // register
                that.memory.hostileIds.push(creep.id);
                // save to trigger subscribers later
                that.newInvader.push(creep);
                // create statistics
                if (SEND_STATISTIC_REPORTS) {
                    let bodyCount = JSON.stringify(_.countBy(creep.body, 'type'));
                    if (that.memory.statistics.invaders === undefined)
                        that.memory.statistics.invaders = [];
                    that.memory.statistics.invaders.push({
                        owner: creep.owner.username,
                        id: creep.id,
                        body: bodyCount,
                        enter: Game.time,
                        time: Date.now()
                    });
                }
            }
        };
        _.forEach(this.hostiles, registerHostile);

        let registerHostileLeave = id => {
            const creep = Game.getObjectById(id);
            const stillHostile = creep && Task.reputation.hostileOwner(creep);
            // for each known invader
            if (!stillHostile) {
                // save to trigger subscribers later
                that.goneInvader.push(id);
                // update statistics
                if (SEND_STATISTIC_REPORTS && that.memory.statistics && that.memory.statistics.invaders !== undefined && that.memory.statistics.invaders.length > 0) {
                    let select = invader => invader.id == id && invader.leave === undefined;
                    let entry = _.find(that.memory.statistics.invaders, select);
                    if (entry != undefined) entry.leave = Game.time;
                }
            }
        };
        _.forEach(this.memory.hostileIds, registerHostileLeave);

        this.memory.hostileIds = this.hostileIds;
    };

    Room.prototype.registerIsHostile = function () {
        if (this.controller) {
            if (_.isUndefined(this.hostile) || typeof this.hostile === 'number') { // not overridden by user
                if (this.controller.owner && !this.controller.my && !this.ally) {
                    this.memory.hostile = this.controller.level;
                } else {
                    delete this.memory.hostile;
                }
            }
        }
    };
};

