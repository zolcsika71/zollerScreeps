"use strict";

const
    ROOT = {
        flagDir: require('./flagDir')
    };

let action = new Creep.Action('dismantling');
module.exports = action;
action.maxPerAction = 3;
action.maxPerTarget = 3;
action.renewTarget = false;
action.isValidAction = creep => creep.carryCapacity === 0 || creep.sum < creep.carryCapacity;
action.isValidTarget = target => target != null;
action.newTarget = creep => {
    let target;
    let flag = ROOT.flagDir.find(global.FLAG_COLOR.destroy.dismantle, creep.pos, true);
    if (flag) {
        if (flag.room !== undefined) { // room is visible
            let targets = flag.room.lookForAt(LOOK_STRUCTURES, flag.pos.x, flag.pos.y);
            if (targets && targets.length > 0)
                return targets[0];
            else { // remove flag. try next flag
                let oldName = flag.name;
                Room.costMatrixInvalid.trigger(flag.room);
                ROOT.flagDir.removeFromDir(flag.name);
                flag.remove();

                let otherFlagMod = (range, flagItem, args) => {
                    if (flagItem.name === args) return Infinity;
                    return range;
                };
                flag = ROOT.flagDir.find(global.FLAG_COLOR.destroy.dismantle, creep.pos, true, otherFlagMod, oldName);
                if (oldName === flag.name)
                    global.Util.logError('Removed flag found again in dismantling.newTarget!');
                if (flag) {
                    if (flag.room !== undefined) { // room is visible
                        let targets = flag.room.lookForAt(LOOK_STRUCTURES, flag.pos.x, flag.pos.y);
                        if (targets && targets.length > 0)
                            return targets[0];
                        else { // remove flag. try next flag
                            Room.costMatrixInvalid.trigger(flag.room);
                            global.FlagDir.removeFromDir(flag.name);
                            flag.remove();
                        }
                    } else target = flag; // target in other room
                }
            }
        } else target = flag; // target in other room
    }
    return target;
};
action.work = creep => creep.dismantle(creep.target);
