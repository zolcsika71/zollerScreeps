"use strict";
/*
const
    _ = require('lodash');
*/

let mod = {},
    profiler;
module.exports = mod;
/**
 * Translates an error code to the type
 * @param {Number} code - The error code / constant
 * @returns {string}
 */
mod.translateErrorCode = function (code) {
    return {
        0: 'OK',
        1: 'ERR_NOT_OWNER',
        2: 'ERR_NO_PATH',
        3: 'ERR_NAME_EXISTS',
        4: 'ERR_BUSY',
        5: 'ERR_NOT_FOUND',
        6: 'ERR_NOT_ENOUGH_RESOURCES',
        7: 'ERR_INVALID_TARGET',
        8: 'ERR_FULL',
        9: 'ERR_NOT_IN_RANGE',
        10: 'ERR_INVALID_ARGS',
        11: 'ERR_TIRED',
        12: 'ERR_NO_BODYPART',
        14: 'ERR_RCL_NOT_ENOUGH',
        15: 'ERR_GCL_NOT_ENOUGH'
    }[code * -1];
};

/**
 * Returns the result of the function or the value passed
 * @param {*} value
 * @param {...*} [args] - A list of arguments to pass if it's a function
 * @returns {*}
 */
mod.fieldOrFunction =  function (value, ...args) {
    return typeof value === 'function' ? value(...args) : value;
};

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
 * Load existing profiling data or initialize to defaults.
 * @param {Boolean} [reset=false] - Optionally reset all profiling data
 */
mod.loadProfiler = (reset = false) => {
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
mod.resetProfiler = () => {
    mod.loadProfiler(true);
};


/**
 * formats an integer into a readable value
 * @param {Number} number
 * @returns {string}
 */
mod.formatNumber = number => {
    let ld = Math.log10(number) / 3;
    if (!number)
        return number;
    let n = number.toString();
    if (ld < 1) {
        return n;
    }
    if (ld < 2) {
        return `${n.substring(0, n.length - 3)}k`;
    }
    if (ld < 3) {
        return `${n.substring(0, n.length - 6)}M`;
    }
    if (ld < 4) {
        return `${n.substring(0, n.length - 9)}B`;
    }
    return number.toString();
};

/**
 * Gets a property from an object and optionally sets the default
 * @param {Object} object - The object
 * @param {string} path - The path to the property within the object
 * @param {*} defaultValue - The default value if property doesn't exist
 * @param {Boolean} [setDefault=true] - Will set the property to the default value if property doesn't exist
 * @returns {*}
 */
mod.get = (object, path, defaultValue, setDefault = true) => {
    const r = _.get(object, path);
    if (_.isUndefined(r) && !_.isUndefined(defaultValue) && setDefault) {
        defaultValue = mod.fieldOrFunction(defaultValue);
        _.set(object, path, defaultValue);
        return _.get(object, path);
    }
    return r;
};


/**
 * Sets a property on an object, optionally if the property doesn't already exist
 * @param {Object} object - The object
 * @param {string} path - The path to the property within the object
 * @param {*} value - The value to set
 * @param {Boolean} [onlyIfNotExists=true] - Will only set the property if it doesn't already exist
 */
mod.set = (object, path, value, onlyIfNotExists = true) => {
    if (onlyIfNotExists) {
        mod.get(object, path, value);
        return;
    }
    _.set(object, path, value);
};

/**
 * Creates and returns a profiling object, use checkCPU to compare usage between calls
 * @param name - The name to use when reporting
 * @param options (enabled true/false)
 * @returns {{totalCPU(), checkCPU()}} - functions to be called to check usage and output totals
 */
mod.startProfiling = (name, options = {enabled: false, startCPU: undefined}) => {
    let enabled = options.enabled,
        startCPU = options.startCPU,
        returnValue,
        checkCPU = (localName, limit, type) => {},
        totalCPU = () => {
        // if you would like to do a baseline comparison
        // if (_.isUndefined(Memory.profiling)) Memory.profiling = {ticks:0, cpu: 0};
        // let thisTick = Game.cpu.getUsed() - startCPU;
        // Memory.profiling.ticks++;
        // Memory.profiling.cpu += thisTick;
        // logSystem('Total', _.round(thisTick, 2) + ' ' + _.round(Memory.profiling.cpu / Memory.profiling.ticks, 2));
    };

    if (global.PROFILE && enabled) {
        if (_.isUndefined(Memory.profiler))
            mod.resetProfiler();
        else if (!profiler || profiler.validTick !== Memory.profiler.validTick || profiler.totalTicks < Memory.profiler.totalTicks)
            mod.loadProfiler();

        const onLoad = startCPU || Game.cpu.getUsed();
        let start = onLoad;

        if (global.PROFILE && !global.PROFILING.BASIC_ONLY) {
            /**
             * Compares usage since startProfiling or the last call to checkCPU and reports if over limit
             * @param {string} localName - The local name to use when reporting
             * @param {Number} limit - CPU threshold for reporting usage
             * @param {string} [type] - Optional, will store average usage for all calls that share this type
             */
            checkCPU = (localName, limit, type) => {
                let current = Game.cpu.getUsed(),
                    used = _.round(current - start, 2);

                if (!limit || used > limit) {
                    mod.logSystem(`${name}:${localName}`, used);
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

        totalCPU = () => {
            let totalUsed = Game.cpu.getUsed() - onLoad,
                avgCPU = profiler.totalCPU / profiler.totalTicks;

            profiler.totalCPU += totalUsed;
            profiler.totalTicks++;
            if (global.PROFILE && !global.PROFILING.BASIC_ONLY && global.PROFILING.AVERAGE_USAGE && _.size(profiler.types) > 0) {
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
            mod.logSystem(name, ` loop:${_.round(totalUsed, 2)}`, `other:${_.round(onLoad, 2)}`, `avg:${_.round(avgCPU, 2)}`, `ticks:${profiler.totalTicks}`, `bucket:${Game.cpu.bucket}`);
            if (global.PROFILE && !global.PROFILING.BASIC_ONLY)
                console.log('\n');
            Memory.profiler = profiler;
        };
    }

    returnValue = {checkCPU, totalCPU};

    return returnValue;
};

/**
 * Get the distance between two points.
 * @param {RoomPosition|Object} point1 - The first point
 * @param {RoomPosition|Object} point2 - The second point
 * @returns {Number}
 */
mod.getDistance = (point1, point2) => Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));

/**
 * Gets the distances between two rooms, respecting natural walls
 * @param {string} fromRoom - Starting room
 * @param {string} toRoom - Ending room
 * @returns {Number}
 */
mod.routeRange = (fromRoom, toRoom) => {
    if (fromRoom === toRoom) return 0;

    return mod.get(Memory, `routeRange.${fromRoom}.${toRoom}`, () => {
        let room = fromRoom instanceof Room ? fromRoom : Game.rooms[fromRoom];

        if (!room)
            return Room.roomDistance(fromRoom, toRoom, false);

        let route = room.findRoute(toRoom, false, false);

        if (!route)
            return Room.roomDistance(fromRoom, toRoom, false);

        return route === ERR_NO_PATH ? Infinity : route.length;
    });
};
mod.creepData = creepName => {
    console.log('Explain');
    Game.creeps[creepName].explain();
    console.log('JSON');
    console.log(JSON.stringify(Game.creeps[creepName].data));
};
