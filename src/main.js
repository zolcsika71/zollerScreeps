function wrapLoop(fn) {
    let memory;
    let tick;

    return () => {
        if (tick && tick + 1 === Game.time && memory) {
            delete global.Memory;
            Memory = memory;
        } else {
            memory = Memory;
        }

        tick = Game.time;

        fn();

        // there are two ways of saving Memory with different advantages and disadvantages
        // 1. RawMemory.set(JSON.stringify(Memory));
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

let modulesValid,
    validatePath = path => {

        let mod;
        try {
            mod = require(path);
        }
        catch (e) {
            if (global.DEBUG !== false && !(e.message && e.message.startsWith('Unknown module'))) {
                console.log('<font style="color:FireBrick">Error loading ' + path
                    + ' caused by ' + (e.stack || e.toString()) + '</font>');
            }
            mod = null;
        }
        return mod != null;
    },
    inject = (base, alien, namespace) => {
        let keys = _.keys(alien);
        for (const key of keys) {
            if (typeof alien[key] === "function") {
                if (namespace) {
                    let original = base[key];
                    if (!base.baseOf) base.baseOf = {};
                    if (!base.baseOf[namespace]) base.baseOf[namespace] = {};
                    if (!base.baseOf[namespace][key]) base.baseOf[namespace][key] = original;
                }
                base[key] = alien[key].bind(base);
            } else if (alien[key] !== null && typeof base[key] === 'object' && !Array.isArray(base[key]) &&
                typeof alien[key] === 'object' && !Array.isArray(alien[key])) {
                _.merge(base[key], alien[key]);
            } else {
                base[key] = alien[key]
            }
        }
    },
    getPath = (modName, reevaluate = false) => {
        if (reevaluate || !Memory.modules[modName]) {
            // find base file
            let path = './custom.' + modName;
            if (!validatePath(path)) {
                path = './internal.' + modName;
                if (!validatePath(path))
                    path = './' + modName;
            }
            Memory.modules[modName] = path;
            // find viral file
            path = './internalViral.' + modName;
            if (validatePath(path))
                Memory.modules.internalViral[modName] = true;
            else if (Memory.modules.internalViral[modName])
                delete Memory.modules.internalViral[modName];
            path = './viral.' + modName;
            if (validatePath(path))
                Memory.modules.viral[modName] = true;
            else if (Memory.modules.viral[modName])
                delete Memory.modules.viral[modName];
        }
        return Memory.modules[modName];
    },
    tryRequire = (path, silent = false) => {
        let mod;
        try {
            mod = require(path);
        } catch (e) {
            if (e.message && e.message.indexOf('Unknown module') > -1) {
                if (!silent) console.log(`Module "${path}" not found!`);
            } else if (mod == null) {
                console.log(`Error loading module "${path}"!<br/>${e.stack || e.toString()}`);
            }
            mod = null;
        }
        return mod;
    },
    infect = (mod, namespace, modName) => {
        if (Memory.modules[namespace][modName]) {
            // get module from stored viral override path
            let viralOverride = tryRequire(`./${namespace}.${modName}`);
            // override
            if (viralOverride) {
                global.inject(mod, viralOverride, namespace);
            }
            // cleanup
            else delete Memory.modules[namespace][modName];
        }
        return mod;
    },
    load = (modName) => {
        // read stored module path
        let path = getPath(modName);
        // try to load module
        let mod = tryRequire(path, true);
        if (!mod) {
            // re-evaluate path
            path = getPath(modName, true);
            // try to load module. Log error to console.
            mod = tryRequire(path);
        }
        if (mod) {
            // load viral overrides
            mod = infect(mod, 'internalViral', modName);
            mod = infect(mod, 'viral', modName);
        }
        return mod;
    },
    install = () => {

        // ensure required memory namespaces
        if (Memory.modules === undefined)  {
            Memory.modules = {
                valid: Game.time,
                modules: {}
            };
        } else if (_.isUndefined(Memory.modules.valid)) {
            Memory.modules.valid = Game.time;
        }

        inject(global, load("global"));

        modulesValid = Memory.modules.valid;


    };







module.exports.loop = wrapLoop(function () {

    const cpuAtLoop = Game.cpu.getUsed();

    if (Memory.pause)
        return;

    try {


        if (_.isUndefined(Memory.modules) || _.isUndefined(modulesValid) || modulesValid !== Memory.modules.valid)
            install();




    }
    catch (e) {
        BB(e.message);
    }

});

