"use strict";

const
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    };

let mod = {};
module.exports = mod;

mod.flagFilter = function (flagColour) {
    if (!flagColour) return;
    let filter;
    if (flagColour.filter) {
        filter = _.clone(flagColour.filter);
    } else {
        filter = {color: flagColour.color, secondaryColor: flagColour.secondaryColor};
    }
    return filter;
};

mod.findName = function (flagColor, pos, local=true, mod, modArgs) {
    let list = this.list;
    if (!flagColor || list.length === 0)
        return null;
    let filter;
    if (pos instanceof Room)
        pos = pos.getPositionAt(25, 25);
    if (typeof flagColor === 'function') {
        filter = function (flagEntry) {
            if (flagColor(flagEntry) && flagEntry.cloaking === 0) {
                if (!local) return true;
                if (pos && pos.roomName && flagEntry.roomName === pos.roomName) return true;
            }
            return false;
        }
    } else {
        filter = this.flagFilter(flagColor);
        _.assign(filter, {cloaking: '0'});
        if (local && pos && pos.roomName) {
            const room = Game.rooms[pos.roomName];
            if (room) {
                list = room.flags;
            } else {
                _.assign(filter, {roomName: pos.roomName});
            }
        }
    }
    let flags = _.filter(list, filter);

    if (flags.length === 0) return null;
    if (flags.length === 1) return flags[0].name;

    // some flags found - find nearest
    if (pos && pos.roomName) {
        let range = flag => {
            let r = 0;
            let roomDist = routeRange(pos.roomName, flag.roomName);
            if (roomDist === 0) {
                r = _.max([Math.abs(flag.x - pos.x), Math.abs(flag.y - pos.y)]);
            } else {
                r = roomDist * 50;
            }
            if (mod) {
                r = mod(r, flag, modArgs);
            }
            flag.valid = r < Infinity;
            return r;
        };
        let flag = _.min(flags, range); //_.sortBy(flags, range)[0];
        return flag.valid ? flag.name : null;
    } else {
        return flags[0].name;
    }
};
mod.find = function (flagColor, pos, local=true, mod, modArgs) {
    if (pos instanceof Room) pos = pos.getPositionAt(25, 25);
    let id = this.findName(flagColor, pos, local, mod, modArgs);
    if (id === null)
        return null;
    return Game.flags[id];
};

mod.flush = function () {
    let clear = flag => delete flag.targetOf;
    _.forEach(Game.flags, clear);
    this.list = [];
    this.stale = [];
    delete this._hasInvasionFlag;
};
mod.analyze = function () {
    let register = flag => {
        try {
            flag.creeps = {};
            if (flag.cloaking && flag.cloaking > 0) flag.cloaking--;
            this.list.push({
                name: flag.name,
                color: flag.color,
                secondaryColor: flag.secondaryColor,
                roomName: flag.pos.roomName,
                x: flag.pos.x,
                y: flag.pos.y,
                cloaking: flag.cloaking
            });
        } catch (e) {
            GLOBAL.util.logError(e.stack || e.message);
        }
    };
    _.forEach(Game.flags, register);

    let findStaleFlags = (entry, flagName) => {
        try {
            if (!Game.flags[flagName]) {
                this.stale.push(flagName);
            }
        } catch (e) {
            GLOBAL.util.logError(e.stack || e.message);
        }
    };
    _.forEach(Memory.flags, findStaleFlags);
    const specialFlag = mod.specialFlag(true);
    return !!specialFlag;
};
mod.execute = function () {
    let triggerFound = entry => {
        try {
            if (!entry.cloaking || entry.cloaking === 0) {
                let p = GLOBAL.util.startProfiling('Flag.execute', {enabled: global.PROFILING.FLAGS}),
                    flag = Game.flags[entry.name];
                Flag.found.trigger(flag);
                p.checkCPU(entry.name, global.PROFILING.EXECUTE_LIMIT, mod.flagType(flag));
            }
        } catch (e) {
            Util.logError(e.stack || e.message);
        }
    };
    this.list.forEach(triggerFound);

    let triggerRemoved = flagName => Flag.FlagRemoved.trigger(flagName);
    this.stale.forEach(triggerRemoved);
};
mod.flagType = function (flag) {
    if (mod.isSpecialFlag(flag)) return '_OCS';
    for (let primary in global.FLAG_COLOR) {
        let type = global.FLAG_COLOR[primary];
        if (Flag.compare(flag, type))
            return primary;

        for (let secondary in type) {
            let subType = type[secondary];
            if (Flag.compare(flag, subType))
                return `${primary}.${secondary}`;
        }
    }
    GLOBAL.util.logError(`Unknown flag type for flag: ${flag ? flag.name : 'undefined flag'}.`);
    return 'undefined';
};
mod.specialFlag = function (create) {
    let name = '_OCS',
        flag = Game.flags[name];
    if (create) {
        if (!flag) {
            return _(Game.rooms).values().some(function (room) {
                room.getPositionAt(49, 49).newFlag({color: COLOR_WHITE, secondaryColor: COLOR_PURPLE}, name);
                return true;
            });
        } else if (flag.pos.roomName !== 'W0N0') {
            flag.setPosition(new RoomPosition(49, 49, 'W0N0'));
        }
    }
    return flag;
};
mod.isSpecialFlag = function (object) {
    return object.name === '_OCS';
};
