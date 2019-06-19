"use strict";

const
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./util.util`)

    };

let mod = {},
    profiler;
module.exports = mod;

/**
 * Checks if the value is an object or function
 * @param {*} value - The value to check
 * @returns {Boolean}
 */
mod.isObject = function (value) {
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
mod.dye = function (style, ...text) {
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
 * Build a stacktrace if DEBUG_STACKS or the first argument is true.
 */
mod.stack = function (force = false, placeholder = ' ') {

    if (GLOBAL.parameter.DEBUG_STACKS || force)
        return new Error(`
STACK; param:${GLOBAL.parameter.DEBUG_STACKS}, force:${force}`).stack;

    return placeholder;
};

/**
 * Trace an error or debug statement
 * @param {string} category - The error category
 * @param {*} entityWhere - The entity where the error was caused
 * @param {Object|string} message - A string or object describing the error
 */
mod.trace = function (category, entityWhere, ...message) {
    function reduceMemoryWhere(result, value, key) {
        const setting = Memory.debugTrace[key];
        if (!Reflect.has(Memory.debugTrace, key))
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

    console.log(Game.time, mod.dye(GLOBAL.parameter.CRAYON.error, category), ...msg, mod.dye(GLOBAL.parameter.CRAYON.birth, JSON.stringify(entityWhere)), mod.stack());
};

/**
 * Logs an error to console
 * @param {string} message - A string describing the error
 * @param {*} [entityWhere] - The entity where the error was caused
 */
mod.logError = function (message, entityWhere) {
    const msg = mod.dye(GLOBAL.parameter.CRAYON.error, message);
    if (entityWhere) {
        mod.trace('error', entityWhere, msg);
    } else {
        console.log(msg, mod.stack());
    }
};

/**
 * Log text as a system message showing a "referrer" as a label
 * @param {string} roomName - The name of the room being logged from
 * @param {...string} message - The message to log
 */
mod.logSystem = function (roomName, ...message) {
    const text = mod.dye(GLOBAL.parameter.CRAYON.system, roomName);
    console.log(mod.dye(GLOBAL.parameter.CRAYON.system, `<a href="/a/#!/room/${Game.shard.name}/${roomName}">${text}</a> &gt;`), ...message, mod.stack());
};

/**
 * Load existing profiling data or initialize to defaults.
 * @param {Boolean} [reset=false] - Optionally reset all profiling data
 */
mod.loadProfiler = function (reset = false) {
    if (reset) {
        mod.logSystem('Profiler', 'resetting profiler data.');
        Memory.profiler = {
            totalCPU: 0,
            totalTicks: 0,
            types: {},
            validTick: Game.time
        };
    }
    profiler = Memory.profiler;
};

/**
 * Reset all profiling data
 */
mod.resetProfiler = function () {
    mod.loadProfiler(true);
};

/**
 * Creates and returns a profiling object, use checkCPU to compare usage between calls
 * @param name - The name to use when reporting
 * @param options (enabled true/false)
 * @returns {{totalCPU(), checkCPU()}} - functions to be called to check usage and output totals
 */

// TODO startCPU: 0?
mod.startProfiling = function (name, options = {enabled: false, startCPU: 0}) {
    const
        enabled = options.enabled,
        startCPU = options.startCPU;

    let returnValue,
        checkCPU = function (localName, limit, type) {

        },
        totalCPU = function () {
            // if you would like to do a baseline comparison
            // if (_.isUndefined(Memory.profiling)) Memory.profiling = {ticks:0, cpu: 0};
            // let thisTick = Game.cpu.getUsed() - startCPU;
            // Memory.profiling.ticks++;
            // Memory.profiling.cpu += thisTick;
            // logSystem('Total', _.round(thisTick, 2) + ' ' + _.round(Memory.profiling.cpu / Memory.profiling.ticks, 2));

        };

    if (GLOBAL.parameter.PROFILE && enabled) {
        if (_.isUndefined(Memory.profiler))
            mod.resetProfiler();
        else if (!profiler || profiler.validTick !== Memory.profiler.validTick || profiler.totalTicks < Memory.profiler.totalTicks)
            mod.loadProfiler();

        const onLoad = startCPU || Game.cpu.getUsed();
        let start = onLoad;

        if (GLOBAL.parameter.PROFILE && !GLOBAL.parameter.PROFILING.BASIC_ONLY) {
            /**
             * Compares usage since startProfiling or the last call to checkCPU and reports if over limit
             * @param {string} localName - The local name to use when reporting
             * @param {Number} limit - CPU threshold for reporting usage
             * @param {string} [type] - Optional, will store average usage for all calls that share this type
             */
            checkCPU = function (localName, limit, type) {
                const
                    current = Game.cpu.getUsed(),
                    used = _.round(current - start, 2);
                if (!limit || used > limit) {
                    mod.logSystem(name + ':' + localName, used);
                }
                if (type) {
                    if (_.isUndefined(profiler.types[type])) profiler.types[type] = {totalCPU: 0, count: 0, totalCount: 0};
                    profiler.types[type].totalCPU += used;
                    profiler.types[type].count++;
                }
                start = current;
            };
        }

        // Calculates total usage and outputs usage based on parameter settings

        totalCPU = function () {
            const
                totalUsed = Game.cpu.getUsed() - onLoad,
                avgCPU = profiler.totalCPU / profiler.totalTicks;

            profiler.totalCPU += totalUsed;
            profiler.totalTicks++;
            if (GLOBAL.parameter.PROFILE && !GLOBAL.parameter.PROFILING.BASIC_ONLY && GLOBAL.parameter.PROFILING.AVERAGE_USAGE && _.size(profiler.types) > 0) {
                let string = '',
                    longestType = '';
                _(profiler.types).map((data, type) => {
                    data.totalCount += data.count;
                    let typeAvg = _.round(data.totalCPU / data.totalCount, 3),
                        r = {
                            type,
                            typeAvg: typeAvg,
                            active: data.count,
                            weighted: _.round(typeAvg * data.count, 3),
                            executions: data.totalCount
                        };
                    data.count = 0;
                    return r;
                }).sortByOrder('weighted', 'desc').forEach(data => {
                    if (data.type.length > longestType.length) longestType = data.type;
                    string += `<tr><td>${data.type}</td><td>     ${data.typeAvg}</td><td>   ${data.active}</td><td>     ${data.weighted}</td><td>   ${data.executions}</td></tr>`;
                }).value();
                string += `</table>`;
                mod.logSystem('Average Usage', `<table style="font-size:80%;"><tr><th>Type${Array(longestType.length + 2).join(' ')}</th><th>(avg/creep/tick)</th><th>(active)</th><th>(weighted avg)</th><th>(executions)</th></tr>`.concat(string));
            }
            mod.logSystem(name, ' loop:' + _.round(totalUsed, 2), 'other:' + _.round(onLoad, 2), 'avg:' + _.round(avgCPU, 2), 'ticks:' + profiler.totalTicks, 'bucket:' + Game.cpu.bucket);
            if (GLOBAL.parameter.PROFILE && !GLOBAL.parameter.PROFILING.BASIC_ONLY)
                console.log('\n');
            Memory.profiler = profiler;
        };
    }

    returnValue = {
        checkCPU: checkCPU(),
        totalCPU: totalCPU()
    };

    return returnValue;
};