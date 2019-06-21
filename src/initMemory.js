"use strict";

const
    _ = require('lodash');

let mod = {};
mod.init = function () {

    // extensions.js
    if (_.isUndefined(Memory.pavementArt))
        Memory.pavementArt = {};

    if (_.isUndefined(Memory.debugTrace))
        Memory.debugTrace = {error: true, no: {}};

    if (_.isUndefined(Memory.cloaked))
        Memory.cloaked = {};


};
module.exports = mod;
