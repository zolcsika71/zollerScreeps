// Override functions into this module to execute functions in main flow
let mod = {};
module.exports = mod;
mod.extend = function () {
    console.log("mainInjection.extend");
};
mod.flush = function() {

    let cancelAllInactiveOrder = function () {

        let inactiveOrders = _.filter(Game.market.orders, order => {
            return !order.active && order.type === 'sell';
        });

        for (let order of inactiveOrders) {

            let resourceType = order.resourceType,
                roomName = order.roomName,
                mineralExist = (Game.rooms[roomName].storage.store[resourceType] || 0) + (Game.rooms[roomName].terminal.store[resourceType] || 0) >= global.SELL_COMPOUND[resourceType].maxStorage + global.MIN_COMPOUND_SELL_AMOUNT;

            if (!mineralExist) {
                global.logSystem(roomName, `Inactive market order found in ${roomName} for ${resourceType}`);
                global.logSystem(roomName, `Order cancelled in ${roomName} for ${resourceType}`);
                Game.market.cancelOrder(order.id);
            }
        }
    };

    cancelAllInactiveOrder();
};
//mod.analyze = function(){};
//mod.register = function(){};
//mod.execute = function(){};
//mod.cleanup = function(){};
