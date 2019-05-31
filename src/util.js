let mod = {};
module.exports = mod;

mod.initMemory = function () {

    Object.keys(Memory).forEach(segment => {

        delete Memory[segment];

    });

};
