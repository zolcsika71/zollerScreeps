
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



inject(global, require('./global.global'));
_.assign(global, require(`./global.parameter`));
global.mainInjection = require(`./mainInjection`);
global.initMemory = require('./initMemory');



// Load modules

_.assign(global, {
    Task: require('./task.task'),
    OcsMemory: require('./ocsMemory'),
    Events: require('./events'),
    FlagDir: require('./flagDir'),
    Population: require('./population'),
    Util: require(`./global.util`),
    Visuals: require('./visuals')
});

// TASK assign

_.assign(global.Task, {
    mining: require('./task.mining'),
    reputation: require('./task.reputation'),
    defense: require('./task.defense')
});

Creep.Action = require('./creep.action.Action');
Creep.Behaviour = require('./creep.behaviour.Behaviour');
Creep.Setup = require('./creep.setup.Setup');

_.assign(Creep, {
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
        hauler: require('./creep.behaviour.hauler'),
        miner: require('./creep.behaviour.miner'),
        ranger: require('./creep.behaviour.ranger'),
        worker: require('./creep.behaviour.worker'),
        upgrader: require('./creep.behaviour.upgrader')

    },
    setup: {
        hauler: require('./creep.setup.hauler'),
        healer: require('./creep.setup.healer'),
        miner: require('./creep.setup.miner'),
        mineralMiner: require('./creep.setup.mineralMiner'),
        privateer: require('./creep.setup.privateer'),
        worker: require('./creep.setup.worker'),
        upgrader: require('./creep.setup.upgrader')
    }
});

inject(Creep, require('./creep.creep'));
inject(Creep, PROTOTYPES.creep);
inject(Creep, PROPERTIES.creep);


inject(Room, require('./room.room'));
inject(Room, PROPERTIES.room);
inject(Room, PROTOTYPES.room);
inject(Room, PROTOTYPES.compounds);

_.assign(Room, {
    _ext: {
        construction: require('./room.construction'),
        containers: require('./room.container'),
        defense: require('./room.defense'),
        links: require('./room.link'),
        spawns: require('./room.spawn'),
        extension: require('./room.extension'),
        lab: require('./room.lab')

    }
});

inject(Spawn, require('./spawn'));
inject(Spawn, PROTOTYPES.spawn);

// plus line!!
global.initMemory.init();

Object.keys(PROPERTIES).forEach(property => {
    PROPERTIES[property].extend();
});
Object.keys(PROTOTYPES).forEach(prototype => {
    PROTOTYPES[prototype].extend();
});

global.Task.populate();

if (global.mainInjection.extend)
    global.mainInjection.extend();

global.OcsMemory.activateSegment(global.MEM_SEGMENTS.COSTMATRIX_CACHE, true);

let Traveler = require('./traveler');
//require('./traveler') ({exportTraveler: false, installTraveler: true, installPrototype: true, defaultStuckValue: global.TRAVELER_STUCK_TICKS, reportThreshold: global.TRAVELER_THRESHOLD});

if (global.DEBUG)
    global.logSystem('Global.install', 'Code reloaded.');

module.exports.loop = wrapLoop(function () {

    const cpuAtLoop = Game.cpu.getUsed();

    if (Memory.pause)
        return;

    try {

        let totalUsage = global.Util.startProfiling('main', {startCPU: cpuAtLoop}),
            p = global.Util.startProfiling('main', {enabled: global.PROFILING.MAIN, startCPU: cpuAtLoop});

        p.checkCPU('deserialize memory', 5);

        // let the cpu recover a bit above the threshold before disengaging to prevent thrashing
        Memory.CPU_CRITICAL = Memory.CPU_CRITICAL ? Game.cpu.bucket < global.CRITICAL_BUCKET_LEVEL + global.CRITICAL_BUCKET_OVERFILL : Game.cpu.bucket < global.CRITICAL_BUCKET_LEVEL;

        if (!cpuAtFirstLoop)
            cpuAtFirstLoop = cpuAtLoop;


        global.Util.set(Memory, 'parameters', {});
        _.assign(global, {parameters: Memory.parameters}); // allow for shorthand access in console
        // ensure up to date parameters, override in memory
        _.assign(global, require(`./global.parameter`));
        _.merge(global, Memory.parameters);

        global.OcsMemory.processSegments();
        p.checkCPU('processSegments', global.PROFILING.ANALYZE_LIMIT);

        // Flush cache

        global.Events.flush();
        global.FlagDir.flush();
        global.Population.flush();
        Room.flush();
        global.Task.flush();

        if (global.mainInjection.flush)
            global.mainInjection.flush();

        p.checkCPU('flush', global.PROFILING.ANALYZE_LIMIT);

        // Room event hooks must be registered before analyze for costMatrixInvalid
        Room.register();

        // analyze environment, wait a tick if critical failure
        if (!global.FlagDir.analyze()) {
            global.logError('flagDir.analyze failed, waiting one tick to sync flags');
            return;
        }
        p.checkCPU('flagDir.analyze', global.PROFILING.ANALYZE_LIMIT);

        Room.analyze();
        p.checkCPU('Room.analyze', global.PROFILING.ANALYZE_LIMIT);

        global.Population.analyze();
        p.checkCPU('Population.analyze', global.PROFILING.ANALYZE_LIMIT);

        if (global.mainInjection.analyze)
            global.mainInjection.analyze();

        // Register event hooks
        Creep.register();
        Spawn.register();
        global.Task.register();

        if (global.mainInjection.register)
            global.mainInjection.register();

        p.checkCPU('register', global.PROFILING.REGISTER_LIMIT);

        // Execution
        global.Population.execute();
        p.checkCPU('population.execute', global.PROFILING.EXECUTE_LIMIT);

        global.FlagDir.execute();
        p.checkCPU('flagDir.execute', global.PROFILING.EXECUTE_LIMIT);

        Room.execute();
        p.checkCPU('room.execute', global.PROFILING.EXECUTE_LIMIT);

        Creep.execute();
        p.checkCPU('creep.execute', global.PROFILING.EXECUTE_LIMIT);

        Spawn.execute();
        p.checkCPU('spawn.execute', global.PROFILING.EXECUTE_LIMIT);

        global.Task.execute();
        p.checkCPU('task.execute', global.PROFILING.EXECUTE_LIMIT);

        if (global.mainInjection.execute)
            global.mainInjection.execute();

        // post-processing
        // SEND statistic reports (not yet)

        global.FlagDir.cleanup();
        p.checkCPU('FlagDir.cleanup', global.PROFILING.FLUSH_LIMIT);

        global.Population.cleanup();
        p.checkCPU('Population.cleanup', global.PROFILING.FLUSH_LIMIT);

        Room.cleanup();
        p.checkCPU('Room.cleanup', global.PROFILING.FLUSH_LIMIT);

        // custom cleanup
        if (global.mainInjection.cleanup)
            global.mainInjection.cleanup();

        global.OcsMemory.cleanup(); // must come last
        p.checkCPU('OCSMemory.cleanup', global.PROFILING.ANALYZE_LIMIT);
        if (global.ROOM_VISUALS && !Memory.CPU_CRITICAL)
            global.Visuals.run(); // At end to correctly display used CPU.
        p.checkCPU('visuals', global.PROFILING.EXECUTE_LIMIT);

        // GRAFANA (not yet)

        Game.cacheTime = Game.time;

        if (global.DEBUG && global.TRACE)
            global.trace('main', {cpuAtLoad, cpuAtFirstLoop, cpuAtLoop, cpuTick: Game.cpu.getUsed(), isNewServer: global.isNewServer, lastServerSwitch: Game.lastServerSwitch, main: 'cpu'});
        totalUsage.totalCPU();
    }
    catch (e) {
        console.log(`ERROR ;)`);
        global.logError(e.stack || e.message);
    }

});

