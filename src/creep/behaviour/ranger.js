"use strict";

let behaviour = new Creep.Behaviour('ranger'),
    super_run = behaviour.run;
module.exports = behaviour;

behaviour.run = function(creep) {
    creep.flee = creep.flee || !creep.hasActiveBodyparts([ATTACK, RANGED_ATTACK]);
    creep.attacking = false;
    creep.attackingRanged = false;
    super_run.call(this, creep);
    this.heal(creep);
};
behaviour.heal = function(creep) {
    if( creep.data.body.heal !== undefined  ) {
        const mustHealSelf = creep.hits < creep.data.hullHits;
        if( mustHealSelf || creep.hits < creep.hitsMax ){
            // Heal self if not attacking or missing combat parts
            if( mustHealSelf || !creep.attacking ) {
                creep.heal(creep);
            }
        }
        // Heal other
        else if( creep.room.casualties.length > 0 ){
            let injured = creep.pos.findInRange(creep.room.casualties, 3);
            if( injured.length > 0 ){
                const target = creep.pos.findClosestByRange(injured);
                const canHeal = creep.pos.isNearTo(target) && !mustHealSelf;
                const shouldHeal = target.data && target.hits < target.data.hullHits;
                // Heal other if not attacking or they are badly hurt
                if( canHeal && (shouldHeal || !creep.attacking) ) {
                    creep.heal(target);
                } else if( shouldHeal && !(creep.attackingRanged || creep.attacking || mustHealSelf)) {
                    creep.rangedHeal(target);
                }
            }
        }
    }
};
behaviour.actions = (creep) => {
    return [
        Creep.action.defending,
        Creep.action.invading,
        Creep.action.guarding,
    ];
};
behaviour.strategies.healing = {
    moveOptions: function (options) {
        options.respectRamparts = true;
        return options;
    }
};
