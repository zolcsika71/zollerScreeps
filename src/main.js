
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

let //_ = require('lodash'),
    cpuAtLoad = Game.cpu.getUsed(),
    CREEP = {},
    GLOBAL = {},
    PROPERTIES = {
        creep: require('./properties.creep'),
        mineral: require('./properties.mineral'),
        roomObject: require('./properties.roomObject'),
        roomPosition: require('./properties.roomPosition'),
        source: require('./properties.source'),
        structures: require('./properties.structures'),
        flag: require('./properties.flag'),
        room: require('./properties.room'),
        lab: require('./properties.lab')
    },
    PROTOTYPES = {
        structures: require('./prototypes.structures'),
        creep: require('./prototypes.creep'),
        spawn: require('./prototypes.spawn'),
        room: require('./prototypes.room'),
        roomPosition: require('./prototypes.roomPosition'),
        compounds: require('./prototypes.compounds'),
        visuals: require('./prototypes.visuals')
    },
    ROOM = {},
    TASK = {},
    ROOT = {};


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

_.assign(GLOBAL, {
    global: require('./global.global'),
    parameter: require(`./global.parameter`)
});

inject(global, GLOBAL.global);
// make parameter accessible from command line
_.assign(global, GLOBAL.parameter);

_.assign(ROOT, {
    mainInjection: require(`./mainInjection`),
    initMemory: require('./initMemory')
});

// Load modules
GLOBAL.util = require(`./global.util`);

TASK.task = require('./task.task');

_.assign(ROOT, {
    ocsMemory: require('./ocsMemory'),
    events: require('./events'),
    flagDir: require('./flagDir'),
    population: require('./population'),
    visuals: require('./visuals')
});

// global assign
_.assign(global, {
    Util: GLOBAL.util,
    Task: TASK.task,
    OCSMemory: ROOT.ocsMemory,
    Events: ROOT.events,
    FlagDir: ROOT.flagDir,
    Population: ROOT.population,
    Visuals: ROOT.visuals
});

_.assign(TASK, {
    mining: require('./task.mining'),
    reputation: require('./task.reputation'),
    defense: require('./task.defense')
});

// TASK assign
_.assign(TASK.task, {
    mining: TASK.mining,
    reputation: TASK.reputation,
    defense: TASK.defense
});

Creep.Action = require('./creep.action.Action');
Creep.Behaviour = require('./creep.behaviour.Behaviour');
Creep.Setup = require('./creep.setup.Setup');

_.assign(CREEP, {
    action: {
        mining: require('./creep.action.mining'),
        recycling: require('./creep.action.recycling'),
        building: require('./creep.action.building'),
        harvesting: require('./creep.action.harvesting'),
        reallocating: require('./creep.action.reallocating'),
        storing: require('./creep.action.storing'),
        uncharging: require('./creep.action.uncharging'),
        withdrawing: require('./creep.action.withdrawing'),
        fueling: require('./creep.action.fueling'),
        feeding: require('./creep.action.feeding'),
        repairing: require('./creep.action.repairing'),
        idle: require('./creep.action.idle'),
        travelling: require('./creep.action.travelling'),
        fortifying: require('./creep.action.fortifying'),
        charging: require('./creep.action.charging'),
        upgrading: require('./creep.action.upgrading'),
        bulldozing: require('./creep.action.bulldozing'),
        picking: require('./creep.action.picking'),
        dismantling: require('./creep.action.dismantling')
    },
    behaviour: {
        miner: require('./creep.behaviour.miner'),
        ranger: require('./creep.behaviour.ranger'),
        worker: require('./creep.behaviour.worker'),
        upgrader: require('./creep.behaviour.upgrader')

    },
    setup: {
        miner: require('./creep.setup.miner'),
        worker: require('./creep.setup.worker'),
        upgrader: require('./creep.setup.upgrader')
    },
    creep: require('./creep.creep')
});

_.assign(Creep, {
    action: {
        mining: CREEP.action.mining,
        recycling: CREEP.action.recycling,
        building: CREEP.action.building,
        harvesting: CREEP.action.harvesting,
        reallocating: CREEP.action.reallocating,
        storing: CREEP.action.storing,
        uncharging: CREEP.action.uncharging,
        withdrawing: CREEP.action.withdrawing,
        fueling: CREEP.action.fueling,
        feeding: CREEP.action.feeding,
        repairing: CREEP.action.repairing,
        idle: CREEP.action.idle,
        travelling: CREEP.action.travelling,
        fortifying: CREEP.action.fortifying,
        charging: CREEP.action.charging,
        upgrading: CREEP.action.upgrading,
        bulldozing: CREEP.action.bulldozing,
        picking: CREEP.action.picking,
        dismantling: CREEP.action.dismantling
    },
    behaviour: {
        miner: CREEP.behaviour.miner,
        ranger: CREEP.behaviour.ranger,
        worker: CREEP.behaviour.worker,
        upgrader: CREEP.behaviour.upgrader

    },
    setup: {
        miner: CREEP.setup.miner,
        worker: CREEP.setup.worker,
        upgrader: CREEP.setup.upgrader

    }
});

inject(Creep, CREEP.creep);
inject(Creep, PROTOTYPES.creep);
inject(Creep, PROPERTIES.creep);

ROOM.room = require('./room.room');
inject(Room, ROOM.room);
inject(Room, PROPERTIES.room);
inject(Room, PROTOTYPES.room);
inject(Room, PROTOTYPES.compounds);




_.assign(ROOM, {
    construction: require('./room.construction'),
    container: require('./room.container'),
    defense: require('./room.defense'),
    link: require('./room.link'),
    spawn: require('./room.spawn'),
    extension: require('./room.extension'),
    lab: require('./room.lab')

});

_.assign(Room, {
    _ext: {
        construction: ROOM.construction,
        containers: ROOM.container,
        defense: ROOM.defense,
        links: ROOM.link,
        spawns: ROOM.spawn,
        extension: ROOM.extension,
        lab: ROOM.lab

    }
});

ROOT.spawn = require('./spawn');
inject(Spawn, ROOT.spawn);
inject(Spawn, PROTOTYPES.spawn);

// plus line!!
ROOT.initMemory.init();

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

//let Traveler = require('./traveler') ({exportTraveler: false, installTraveler: true, installPrototype: true, defaultStuckValue: global.TRAVELER_STUCK_TICKS, reportThreshold: global.TRAVELER_THRESHOLD});
require('./traveler') ({exportTraveler: false, installTraveler: true, installPrototype: true, defaultStuckValue: global.TRAVELER_STUCK_TICKS, reportThreshold: global.TRAVELER_THRESHOLD});

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
        ROOT.flagDir.flush();
        ROOT.population.flush();
        ROOM.room.flush();
        TASK.task.flush();

        if (ROOT.mainInjection.flush)
            ROOT.mainInjection.flush();

        p.checkCPU('flush', global.PROFILING.ANALYZE_LIMIT);

        // Room event hooks must be registered before analyze for costMatrixInvalid
        ROOM.room.register();

        // analyze environment, wait a tick if critical failure
        if (!ROOT.flagDir.analyze()) {
            GLOBAL.util.logError('flagDir.analyze failed, waiting one tick to sync flags');
            return;
        }
        p.checkCPU('flagDir.analyze', global.PROFILING.ANALYZE_LIMIT);

        ROOM.room.analyze();
        p.checkCPU('Room.analyze', global.PROFILING.ANALYZE_LIMIT);

        ROOT.population.analyze();
        p.checkCPU('Population.analyze', global.PROFILING.ANALYZE_LIMIT);

        if (ROOT.mainInjection.analyze)
            ROOT.mainInjection.analyze();

        // Register event hooks
        CREEP.creep.register();
        ROOT.spawn.register();
        TASK.task.register();

        if (ROOT.mainInjection.register)
            ROOT.mainInjection.register();

        p.checkCPU('register', global.PROFILING.REGISTER_LIMIT);

        // Execution
        ROOT.population.execute();
        p.checkCPU('population.execute', global.PROFILING.EXECUTE_LIMIT);

        ROOT.flagDir.execute();
        p.checkCPU('flagDir.execute', global.PROFILING.EXECUTE_LIMIT);

        ROOM.room.execute();
        p.checkCPU('room.execute', global.PROFILING.EXECUTE_LIMIT);

        CREEP.creep.execute();
        p.checkCPU('creep.execute', global.PROFILING.EXECUTE_LIMIT);

        ROOT.spawn.execute();
        p.checkCPU('spawn.execute', global.PROFILING.EXECUTE_LIMIT);

        TASK.task.execute();
        p.checkCPU('task.execute', global.PROFILING.EXECUTE_LIMIT);

        if (ROOT.mainInjection.execute)
            ROOT.mainInjection.execute();

        // post-processing
        // SEND statistic reports (not yet)

        ROOT.flagDir.cleanup();
        p.checkCPU('FlagDir.cleanup', global.PROFILING.FLUSH_LIMIT);

        ROOT.population.cleanup();
        p.checkCPU('Population.cleanup', global.PROFILING.FLUSH_LIMIT);

        ROOM.room.cleanup();
        p.checkCPU('Room.cleanup', global.PROFILING.FLUSH_LIMIT);

        // custom cleanup
        if (ROOT.mainInjection.cleanup)
            ROOT.mainInjection.cleanup();

        ROOT.ocsMemory.cleanup(); // must come last
        p.checkCPU('OCSMemory.cleanup', global.PROFILING.ANALYZE_LIMIT);

        if (global.ROOM_VISUALS && !Memory.CPU_CRITICAL)
            ROOT.visuals.run(); // At end to correctly display used CPU.
        p.checkCPU('visuals', global.PROFILING.EXECUTE_LIMIT);

        // GRAFANA (not yet)

        Game.cacheTime = Game.time;

        if (global.DEBUG && global.TRACE)
            GLOBAL.util.trace('main', {cpuAtLoad, cpuAtFirstLoop, cpuAtLoop, cpuTick: Game.cpu.getUsed(), isNewServer: global.isNewServer, lastServerSwitch: Game.lastServerSwitch, main: 'cpu'});
        totalUsage.totalCPU();
    }
    catch (e) {
        console.log(`ERROR ;)`);
        GLOBAL.util.logError(e.stack || e.message);
    }

});

