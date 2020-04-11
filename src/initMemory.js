"use strict";

let mod = {};

module.exports = mod;

mod.init = () => {

    // extensions.js
    if (_.isUndefined(Memory.pavementArt))
        Memory.pavementArt = {};

    if (_.isUndefined(Memory.debugTrace))
        Memory.debugTrace = {error: true, no: {}};

    if (_.isUndefined(Memory.cloaked))
        Memory.cloaked = {};

    // plus line
    if (_.isUndefined(Memory.rooms))
        Memory.rooms = {};

};

