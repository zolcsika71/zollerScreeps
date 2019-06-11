let mod = {};
module.exports = mod;

mod.BB = function (x) {
    console.log(JSON.stringify(x, null, 2));
};

mod.execute = function () {

    return true;

};

mod.initMemory = function () {

    Object.keys(Memory).forEach(segment => {

        console.log(segment);

        delete Memory[segment];

    });

};

