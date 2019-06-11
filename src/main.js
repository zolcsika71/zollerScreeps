
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
    getPath = (modName, reEvaluate = false) => {

        let paths;

        if (reEvaluate || !Memory.modules[modName]) {

            paths = _.filter(parameter.DIRECTORIES, directory => {

                return validatePath(directory + modName);

            });

            if (paths.length > 0) {
                for (let path of paths)
                    Memory.modules[modName] = path + modName;
            } else
                delete Memory.modules[modName];

        }

        return Memory.modules[modName];
    },
    tryRequire = (path, silent = false) => {
        let mod;
        try {
            mod = require(path);
        } catch (e) {
            if (e.message && e.message.indexOf('Unknown module') > -1) {
                if (!silent)
                    console.log(`Module "${path}" not found!`);
            } else if (mod == null) {
                console.log(`Error loading module "${path}"!<br/>${e.stack || e.toString()}`);
            }
            mod = null;
        }
        return mod;
    },
    inject = (base, alien, namespace) => {
        let keys = _.keys(alien);
        for (const key of keys) {
            if (typeof alien[key] === "function") {
                if (namespace) {
                    let original = base[key];
                    if (!base.baseOf)
                        base.baseOf = {};
                    if (!base.baseOf[namespace])
                        base.baseOf[namespace] = {};
                    if (!base.baseOf[namespace][key])
                        base.baseOf[namespace][key] = original;
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
    load = (modName) => {
        // read stored module path
        let path = getPath(modName);
        // try to load module
        let mod = tryRequire(path, true);
        if (!mod) {
            console.log('reEvaluate!');
            // re-evaluate path
            path = getPath(modName, true);
            // try to load module. Log error to console.
            mod = tryRequire(path);
        }
        console.log(`${modName} load returns: ${BB(mod)}`);
        //BB(mod);
        return mod;
    },
    BB = function (x) {
        return JSON.stringify(x, null, 2);

    },
    install = () => {

        console.log("Install");

        let

            loadGlobal = require('./global'),
            loadParameter = require('./parameter');
            //loadParameter = load("parameter"),
            //loadGlobal = load("global"),
            //mainInjection = load("mainInjection");

        console.log(`global : ${BB(loadGlobal)}`);
        console.log(`parameter : ${BB(loadParameter)}`);

        loadGlobal.BB(global);

        //inject(global, loadGlobal);

        //console.log(`after inject global: `);


        //_.assign(global, loadParameter);

        //console.log(`after _.assign loadParameter to global:`);
        // ${BB(global)}



        //console.log(`after load mainInjection : ${BB(mainInjection)}`);

        modulesValid = Memory.modules.valid;




    };







module.exports.loop = wrapLoop(function () {

    const cpuAtLoop = Game.cpu.getUsed();

    if (Memory.pause)
        return;

    try {

        // ensure required memory namespaces
        if (Memory.modules === undefined)  {
            Memory.modules = {
                valid: Game.time
            };
        } else if (_.isUndefined(Memory.modules.valid)) {
            Memory.modules.valid = Game.time;
        }


        if (_.isUndefined(Memory.modules) || _.isUndefined(modulesValid) || modulesValid !== Memory.modules.valid)
            install();




    }
    catch (e) {
        BB(e.message);
    }

});

