"use strict";

const
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    };

let mod = {};
module.exports = mod;

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
            if (flag.cloaking && flag.cloaking > 0)
                flag.cloaking--;
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
mod.specialFlag = function(create) {
    const name = '_OCS';
    const flag = Game.flags[name];
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
