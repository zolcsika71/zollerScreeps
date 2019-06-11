let mod = {};
module.exports = mod;

mod.initMemory = function () {

    Object.keys(Memory).forEach(segment => {

        console.log(segment);

        delete Memory[segment];

    });

};
