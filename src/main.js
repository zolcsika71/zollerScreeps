
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
        action: {
            Action: require('./creep.action.Action'),
            mining: require('./creep.action.mining')
        },
        behaviour: {
            Behaviour: require('./creep.behaviour.Behaviour')
        },
        setup: {
            Setup: require('./creep.setup.Setup')
        },
        creep: require('./creep.creep')
    },
    GLOBAL = {
        global: require('./global.global'),
        parameter: require(`./global.parameter`),
        util: require(`./global.util`)
    },
    PROPERTIES = {
        creep: require('./properties.creep'),
        mineral: require('./properties.mineral'),
        roomObject: require('./properties.roomObject'),
        roomPosition: require('./properties.roomPosition'),
        source: require('./properties.source'),
        structures: require('./properties.structures'),
        flag: require('./properties.flag'),
        room: require('./properties.room')
    },
    PROTOTYPES = {
        structures: require('./prototypes.structures'),
        creep: require('./prototypes.creep'),
        spawn: require('./prototypes.spawn'),
        room: require('./prototypes.room'),
        roomPosition: require ('./prototypes.roomPosition')
    },
    ROOM = {
        room: require('./room.room')
    },
    TASK = {
        task: require('./task.task'),
        mining: require('./task.mining')
    },
    ROOT = {
        mainInjection: require(`./mainInjection`),
        ocsMemory: require('./ocsMemory'),
        initMemory: require('./initMemory'),
        events: require('./events'),
        flagDir: require('./flagDir'),
        population: require('./population')
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
},
    cpuAtFirstLoop;




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
    Population: CREEP.population,
    Task: TASK.task,
    OCSMemory: ROOT.ocsMemory,
    Events: ROOT.events,
    FlagDir: ROOT.flagDir
});

_.assign(TASK.task, {

    mining: TASK.mining


});


_.assign(Creep, {
    action: {
        mining: CREEP.action.mining

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

inject(Room, ROOM.room);
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

TASK.task.populate();

if (ROOT.mainInjection.extend)
    ROOT.mainInjection.extend();

ROOT.ocsMemory.activateSegment(global.MEM_SEGMENTS.COSTMATRIX_CACHE, true);
ROOT.traveler = require('./traveler') ({exportTraveler: false, installTraveler: true, installPrototype: true, defaultStuckValue: global.TRAVELER_STUCK_TICKS, reportThreshold: global.TRAVELER_THRESHOLD});

if (global.DEBUG)
    GLOBAL.util.logSystem('Global.install', 'Code reloaded.');

module.exports.loop = wrapLoop(function () {

    const cpuAtLoop = Game.cpu.getUsed();

    if (Memory.pause)
        return;

    try {

        let totalUsage = GLOBAL.util.startProfiling('main', {startCPU: cpuAtLoop}),
            p = GLOBAL.util.startProfiling('main', {enabled: global.PROFILING.MAIN, startCPU: cpuAtLoop});

        p.checkCPU('deserialize memory', 5);

        // let the cpu recover a bit above the threshold before disengaging to prevent thrashing
        Memory.CPU_CRITICAL = Memory.CPU_CRITICAL ? Game.cpu.bucket < global.CRITICAL_BUCKET_LEVEL + global.CRITICAL_BUCKET_OVERFILL : Game.cpu.bucket < global.CRITICAL_BUCKET_LEVEL;

        if (!cpuAtFirstLoop)
            cpuAtFirstLoop = cpuAtLoop;


        GLOBAL.util.set(Memory, 'parameters', {});
        _.assign(global, {parameters: Memory.parameters}); // allow for shorthand access in console
        // ensure up to date parameters, override in memory
        _.assign(global, GLOBAL.parameter);
        _.merge(global, parameters);

        ROOT.ocsMemory.processSegments();
        p.checkCPU('processSegments', global.PROFILING.ANALYZE_LIMIT);

        // Flush cache
        ROOT.events.flush();
        ROOT.flag.flush();
        ROOT.population.flush();
        ROOM.room.flush();
        TASK.task.flush();

        if (ROOT.mainInjection.flush)
            ROOT.mainInjection.flush();

        p.checkCPU('flush', global.PROFILING.ANALYZE_LIMIT);

        // Room event hooks must be registered before analyze for costMatrixInvalid
        ROOM.room.register();

        // analyze environment, wait a tick if critical failure
        if (!ROOT.flag.analyze()) {
            GLOBAL.util.logError('flag.analyze failed, waiting one tick to sync flags');
            return;
        }
        p.checkCPU('flag.analyze', global.PROFILING.ANALYZE_LIMIT);
        ROOM.room.analyze();




    }
    catch (e) {
        console.log(`ERROR ;)`);
        console.log(e.message, e.stack);
    }

});

