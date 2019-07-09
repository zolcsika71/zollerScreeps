"use strict";

let mod = {};
module.exports = mod;
mod.extend = function () {

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

};

