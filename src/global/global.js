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

mod.len = function (number) {
    return ("00" + number).slice(-2);
};

mod.toLocalDate = function (date) {
    if (!date)
        date = new Date();
    let offset = global.TIME_ZONE;
    if (global.USE_SUMMERTIME && mod.isSummerTime(date)) offset++;
    return new Date(date.getTime() + (3600000 * offset));
};

// for notify mails: format dateTime (as date & time)
mod.toDateTimeString = function (date) {
    return (mod.len(date.getDate()) + "." + mod.len(date.getMonth() + 1) + "." + mod.len(date.getFullYear()) + " " + mod.len(date.getHours()) + ":" + mod.len(date.getMinutes()) + ":" + mod.len(date.getSeconds()));
};
mod.isSummerTime = function (date) {
    let year = date.getFullYear();
    // last sunday of march
    let temp = new Date(year, 2, 31),
        begin = new Date(year, 2, temp.getDate() - temp.getDay(), 2, 0, 0);
    // last sunday of october
    temp = new Date(year, 9, 31);
    let end = new Date(year, 9, temp.getDate() - temp.getDay(), 3, 0, 0);

    return (begin < date && date < end);
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

mod.guid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

