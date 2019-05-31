let mod = {};
module.exports = mod;

mod.initMemory = function () {

    if (_.max(Memory))

    Object.keys(Memory).forEach(segment => {

        delete Memory[segment];

    });

};
