
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


let _ = require('lodash'),
    inject = (base, alien, namespace) => {
        let keys = _.keys(alien);
        console.log(`alien keys: ${keys}`);
        for (const key of keys) {
            if (typeof alien[key] === "function") {
                console.log(`it is a FN`);
                if (namespace) {
                    let original = base[key];
                    console.log(`nameSpace: ${original}`);
                    if (!base.baseOf)
                        base.baseOf = {};
                    if (!base.baseOf[namespace])
                        base.baseOf[namespace] = {};
                    if (!base.baseOf[namespace][key])
                        base.baseOf[namespace][key] = original;
                }
                base[key] = alien[key].bind(base);
                console.log(`base: `);

            } else if (alien[key] !== null && typeof base[key] === 'object' && !Array.isArray(base[key]) &&
                typeof alien[key] === 'object' && !Array.isArray(alien[key])) {
                _.merge(base[key], alien[key]);
            } else {
                base[key] = alien[key]
            }
        }
        console.log(`hello ${json(alien[key])}`);
        console.log(`base: ${json(base[key])}`);
    },
    load = (modName) => {
        return require('./' + modName);
    },
    json = (x) => {
        return JSON.stringify(x, null, 2);
    };











module.exports.loop = wrapLoop(function () {

    const cpuAtLoop = Game.cpu.getUsed();

    if (Memory.pause)
        return;

    try {

        inject(global, load('global'));

    }
    catch (e) {
        json(e.message);
    }

});

