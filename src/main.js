
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
    //_ = require('lodash'),
    CREEP = {
        Action: require('./creep.Action'),
        Behaviour: require('./creep.Behaviour'),
        Setup: require('./creep.Setup'),
        creep: require('./creep.creep')


    },
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./util.util`)

    },
    PROPERTIES = {
        structures: require('./properties.structures')
    },
    PROTOTYPES = {
        mineral: require('./prototypes.mineral'),
        roomObject: require('./prototypes.roomObject'),
        roomPosition: require('./prototypes.roomPosition'),
        source: require('./prototypes.source'),
        structures: require('./prototypes.structures')
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

Creep.Action = CREEP.Action;
Creep.Behaviour = CREEP.Behaviour;
Creep.Setup = CREEP.Setup;


// make parameter accessible from command line
_.assign(global, GLOBAL.parameter);

// make util accessible from command line usage: Util.fn();
_.assign(global, {
    Util: GLOBAL.util
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
        GLOBAL.global.consoleMe();
        console.log(`${GLOBAL.parameter.DEBUG}`);
        GLOBAL.util.dye()




    }
    catch (e) {
        console.log(`ERROR ;)`);
        console.log(e.message, e.stack);
    }

});

