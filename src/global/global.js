let mod = {};
module.exports = mod;


mod.BB = function (x) {
    console.log(JSON.stringify(x, null, 2));
};

mod.json = (x) => {
    return JSON.stringify(x, null, 2);
};

mod.execute = function () {

    //console.log(Parameter.DEBUG);

    return true;

};

mod.consoleMe = function () {

    console.log(`global`);

};

mod.initMemory = function () {

    Object.keys(Memory).forEach(segment => {

        console.log(segment);

        delete Memory[segment];

    });

};

