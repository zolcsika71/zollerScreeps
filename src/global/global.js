"use strict";

let mod = {};
module.exports = mod;

/**
 * Build a stacktrace if DEBUG_STACKS or the first argument is true.
 */
mod.stack = (force = false, placeholder = ' ') => {

    if (global.DEBUG_STACKS || force)
        return new Error(`\nSTACK; param:${global.DEBUG_STACKS}, force:${force}`).stack;

    return placeholder;
};

/**
 * Checks if the value is an object or function
 * @param {*} value - The value to check
 * @returns {Boolean}
 */
mod.isObject = value => {
    if (value === null)
        return false;
    return typeof value === 'function' || typeof value === 'object';
};

/**
 * Returns a HTML formatted string with the style applied
 * @param {Object|string} style - Either a colour string or an object with CSS properties
 * @param {...string} text - The text to format
 * @returns {string}
 */
mod.dye = (style, ...text) => {
    const msg = text.join(' ');
    if (mod.isObject(style)) {
        let css = '',
            format = key => css += `${key}: ${style[key]};`;
        _.forEach(Object.keys(style), format);
        return `<span style="${css}">${msg}</span>`;
    }
    if (style)
        return `<span style="color: ${style}">${msg}</span>`;

    return msg;
};

/**
 * Trace an error or debug statement
 * @param {string} category - The error category
 * @param {*} entityWhere - The entity where the error was caused
 * @param {Object|string} message - A string or object describing the error
 */
mod.trace = (category, entityWhere, ...message) => {
    function reduceMemoryWhere(result, value, key) {
        const setting = Memory.debugTrace[key];
        /*
        if (!Reflect.has(Memory.debugTrace, key))
            return result;

         */
        if (_.some(_.keys(Memory.debugTrace), prop => {
            return key === prop;
        }))
            return result;
        else if (result)
            return setting === value || (!value && setting === `${value}`);
        return false;
    }
    function noMemoryWhere(e) {
        const setting = Memory.debugTrace.no[e[0]];
        return setting === true || e[0] in Memory.debugTrace.no &&
            (setting === e[1] || (!e[1] && setting === `${e[1]}`));
    }
    if (!(Memory.debugTrace[category] === true || _(entityWhere).reduce(reduceMemoryWhere, 1) === true))
        return;
    if (Memory.debugTrace.no && _(entityWhere).pairs().some(noMemoryWhere) === true)
        return;

    let msg = message,
        key;

    if (message.length === 0 && category) {

        let leaf = category;
        do {
            key = leaf;
            leaf = entityWhere[leaf];
        } while (entityWhere[leaf] && leaf !== category);

        if (leaf && leaf !== category) {
            if (typeof leaf === 'string')
                msg = [leaf];
            else
                msg = [key, '=', leaf];
        }
    }

    console.log(Game.time, mod.dye(global.CRAYON.error, category), ...msg, mod.dye(global.CRAYON.birth, JSON.stringify(entityWhere)), mod.stack());
};

/**
 * Logs an error to console
 * @param {string} message - A string describing the error
 * @param {*} [entityWhere] - The entity where the error was caused
 */
mod.logError = (message, entityWhere) => {
    const msg = mod.dye(global.CRAYON.error, message);
    if (entityWhere) {
        mod.trace('error', entityWhere, msg);
    } else {
        console.log(msg, mod.stack());
    }
};

/**
 * Log text as a system message showing a "preFix" as a label
 * @param {string} preFix - text displaying before message
 * @param {...string} message - The message to log
 */
mod.logSystem = (preFix, ...message) => {
    const text = mod.dye(global.CRAYON.system, preFix);
    console.log(mod.dye(global.CRAYON.system, `<a href="/a/#!/room/${Game.shard.name}/${preFix}">${text}</a> &gt;`), ...message, mod.stack());
};

mod.BB = x => {
    console.log(JSON.stringify(x, null, 2));
};
mod.json = x => {
    return JSON.stringify(x, null, 2);
};
mod.len = number => ("00" + number).slice(-2);
mod.toLocalDate = date => {
    if (!date)
        date = new Date();
    let offset = global.TIME_ZONE;
    if (global.USE_SUMMERTIME && mod.isSummerTime(date)) offset++;
    return new Date(date.getTime() + (3600000 * offset));
};
// for notify mails: format dateTime (as date & time)
mod.toDateTimeString = date => mod.len(date.getDate()) + "." + mod.len(date.getMonth() + 1) + "." + mod.len(date.getFullYear()) + " " + mod.len(date.getHours()) + ":" + mod.len(date.getMinutes()) + ":" + mod.len(date.getSeconds());
mod.isSummerTime = ídate => {
    let year = date.getFullYear();
    // last sunday of march
    let temp = new Date(year, 2, 31),
        begin = new Date(year, 2, temp.getDate() - temp.getDay(), 2, 0, 0);
    // last sunday of october
    temp = new Date(year, 9, 31);
    let end = new Date(year, 9, temp.getDate() - temp.getDay(), 3, 0, 0);

    return begin < date && date < end;
};
mod.execute = () => {

    //console.log(Parameter.DEBUG);

    return true;

};
mod.initMemory = () => {

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
            global.logError('Error in LiteEvent.trigger: ' + (e.stack || e));
        }
    }
};
mod.addById = (array, id) => {
    if (array == null)
        array = [];
    let obj = Game.getObjectById(id);
    if (obj)
        array.push(obj);
    return array;
};
mod.guid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 0x3 | 0x8;
    return v.toString(16);
});
mod.LAB_REACTIONS = {};
for (let a in REACTIONS) {
    for (let b in REACTIONS[a]) {
        mod.LAB_REACTIONS[REACTIONS[a][b]] = [a, b];
    }
}
mod = _.bindAll(mod);

