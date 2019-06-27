"use strict";

const
    GLOBAL = {
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    };



let mod = {};
module.exports = mod;


mod.BB = function (x) {
    console.log(JSON.stringify(x, null, 2));
};

mod.json = (x) => {
    return JSON.stringify(x, null, 2);
};

mod.execute = function () {

    //console.log(Parameter.DEBUG);

    return true;

};

mod.consoleMe = function () {

    console.log(`global`);

};

mod.initMemory = function () {

    Object.keys(Memory).forEach(segment => {

        console.log(segment);

        delete Memory[segment];

    });

};

// base class for events
mod.LiteEvent = function () {
    // registered subscribers
    this.handlers = [];
    // register a new subscriber
    this.on = function (handler) {
        this.handlers.push(handler);
    };
    // remove a registered subscriber
    this.off = function (handler) {
        this.handlers = this.handlers.filter(h => h !== handler);
    };
    // call all registered subscribers
    this.trigger = function (data) {
        try {
            this.handlers.slice(0).forEach(h => h(data));
        } catch (e) {
            GLOBAL.util.logError('Error in LiteEvent.trigger: ' + (e.stack || e));
        }
    }
};

mod.addById = function (array, id) {
    if (array == null)
        array = [];
    let obj = Game.getObjectById(id);
    if (obj)
        array.push(obj);
    return array;
};

