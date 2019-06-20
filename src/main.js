
function wrapLoop(fn) {
    let memory,
        tick;

    return () => {
        if (tick && tick + 1 === Game.time && memory) {
            delete global.Memory;
            Memory = memory;
        } else
            memory = Memory;

        tick = Game.time;
        fn();

        // there are two ways of saving Memory with different advantages and disadvantages
        // 1. RawMemory.set(json.stringify(Memory));
        // + ability to use custom serialization method
        // - you have to pay for serialization
        // - unable to edit Memory via Memory watcher or console
        // 2. RawMemory._parsed = Memory;
        // - undocumented functionality, could get removed at any time
        // + the server will take care of serialization, it doesn't cost any CPU on your site
        // + maintain full functionality including Memory watcher and console

        RawMemory._parsed = Memory;
    };
}

const
    _ = require('lodash'),
    CREEP = {
        action: {
            Action: require('./creep.action.Action'),
        },
        behaviour: {
            Behaviour: require('./creep.behaviour.Behaviour'),
        },
        setup: {
            Setup: require('./creep.setup.Setup'),
        },
        creep: require('./creep.creep'),
        population: require('./creep.population')
    },
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./util.util`)

    },
    PROPERTIES = {
        mineral: require('./properties.mineral'),
        roomObject: require('./properties.roomObject'),
        roomPosition: require('./properties.roomPosition'),
        source: require('./properties.source'),
        structures: require('./properties.structures')
    },
    PROTOTYPES = {
        structures: require('./prototypes.structures'),
        creep: require('./prototypes.creep')
    },
    ROOM = {
        room: require('./room.room')
    },
    ROOT = {
        mainInjection: require(`./mainInjection`),
        spawn: require('./spawn')
    };


let inject = (base, alien, namespace) => {
    let keys = _.keys(alien);
    for (let key of keys) {
        if (typeof alien[key] === "function") {
            if (namespace) {
                let original = base[key];
                //console.log(`nameSpace: ${original}`);
                if (!base.baseOf)
                    base.baseOf = {};
                if (!base.baseOf[namespace])
                    base.baseOf[namespace] = {};
                if (!base.baseOf[namespace][key])
                    base.baseOf[namespace][key] = original;
            }
            base[key] = alien[key].bind(base);

        } else if (alien[key] !== null && typeof base[key] === 'object' && !Array.isArray(base[key])
            && typeof alien[key] === 'object' && !Array.isArray(alien[key]))
            _.merge(base[key], alien[key]);
        else
            base[key] = alien[key];
    }
};



inject(global, GLOBAL.global);
inject(Creep, CREEP.creep);
inject(Room, ROOM.room);
inject(Spawn, ROOT.spawn);

Creep.Action = CREEP.action.Action;
Creep.Behaviour = CREEP.behaviour.Behaviour;
Creep.Setup = CREEP.setup.Setup;


// make parameter accessible from command line
_.assign(global, GLOBAL.parameter);

// make util accessible from command line usage: Util.fn();
_.assign(global, {
    Util: GLOBAL.util,
    Population: CREEP.population
});


_.assign(Creep, {
    action: {

    },
    behaviour: {

    },
    setup: {

    }
});

_.assign(Room, {
    _ext: {

    }
});

Object.keys(PROPERTIES).forEach(property => {
    PROPERTIES[property].extend();
});
Object.keys(PROTOTYPES).forEach(prototype => {
    PROTOTYPES[prototype].extend();
});



module.exports.loop = wrapLoop(function () {

    const cpuAtLoop = Game.cpu.getUsed();

    if (Memory.pause)
        return;

    try {





    }
    catch (e) {
        console.log(`ERROR ;)`);
        console.log(e.message, e.stack);
    }

});

