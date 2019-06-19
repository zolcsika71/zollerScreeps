
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
    //Global = require('./global.global'),
    //Parameter = require(`./global.parameter`),
    //Util = require(`./util.util`),
    //_creep = require('./creep.creep'),
    //_room = require('./room.room'),
    //_spawn = require('./spawn'),


    _creep = {
        Action: require('./creep.Action'),
        Behaviour: require('./creep.Behaviour'),
        Setup: require('./creep.Setup'),
        creep: require('./creep.creep'),


    },
    _global = {
        parameter: require(`./global.parameter`),
        global: require('./global.global')

    },
    _properties = {
      structures: require('./properties.structures')
    },
    _prototypes = {
        mineral: require('./prototypes.mineral'),
        roomObject: require('./prototypes.roomObject'),
        roomPosition: require('./prototypes.roomPosition'),
        source: require('./prototypes.source'),
        structures: require('./prototypes.structures'),
    },
    _room = {
        room: require('./room.room'),
    },
    _util = {
        util: require(`./util.util`)
    },
    _root = {
        mainInjection: require(`./mainInjection`),
        spawn: require('./spawn')
    };


let inject = (base, alien, namespace) => {
    let keys = _.keys(alien);
    console.log(`alien keys: ${keys}`);
    for (let key of keys) {
        if (typeof alien[key] === "function") {
            console.log(`it is a fn()`);
            if (namespace) {
                let original = base[key];
                console.log(`nameSpace: ${original}`);
                if (!base.baseOf)
                    base.baseOf = {};
                if (!base.baseOf[namespace])
                    base.baseOf[namespace] = {};
                if (!base.baseOf[namespace][key])
                    base.baseOf[namespace][key] = original;
            } else
                console.log(`no namespace`);
            base[key] = alien[key].bind(base);

        } else if (alien[key] !== null && typeof base[key] === 'object' && !Array.isArray(base[key])
            && typeof alien[key] === 'object' && !Array.isArray(alien[key])) {
            console.log(`it is a object`);
            _.merge(base[key], alien[key]);

        } else {
            console.log(`it is a array?`);
            base[key] = alien[key];
        }
        console.log(`base: ${key}, ${base[key]}`);
    }
};

inject(global, _global.global);
inject(Creep, _creep.creep);
inject(Room, _room.room);
inject(Spawn, _root.spawn);

Creep.Action = _creep.Action;
Creep.Behaviour = _creep.Behaviour;
Creep.Setup = _creep.Setup;


_.assign(global, {

    Util: _util.util

});

_.assign(global, {

    Util: _util.util

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

Object.keys(_properties).forEach(property => {
    _properties[property].extend();
});
Object.keys(_prototypes).forEach(prototype => {
    _prototypes[prototype].extend();
});



module.exports.loop = wrapLoop(function () {

    const cpuAtLoop = Game.cpu.getUsed();

    if (Memory.pause)
        return;

    try {
        _global.global.consoleMe();
        console.log(`${_global.parameter.DEBUG}`);
        _util.util.consoleMe();




    }
    catch (e) {
        console.log(`ERROR ;)`);
        console.log(e.message, e.stack);
    }

});

