"use strict";

let mod = {};

module.exports = mod;

mod.extend = () => {

    const
        PROPERTIES = {
            creep: require('./properties.creep'),
            mineral: require('./properties.mineral'),
            roomObject: require('./properties.roomObject'),
            roomPosition: require('./properties.roomPosition'),
            source: require('./properties.source'),
            structures: require('./properties.structures'),
            flag: require('./properties.flag'),
            room: require('./properties.room'),
            lab: require('./properties.lab')
        },
        PROTOTYPES = {
            structures: require('./prototypes.structures'),
            creep: require('./prototypes.creep'),
            spawn: require('./prototypes.spawn'),
            room: require('./prototypes.room'),
            roomPosition: require('./prototypes.roomPosition'),
            compounds: require('./prototypes.compounds'),
            visuals: require('./prototypes.visuals')
        };

    Object.keys(PROPERTIES).forEach(property => {
        PROPERTIES[property].extend();
    });
    Object.keys(PROTOTYPES).forEach(prototype => {
        PROTOTYPES[prototype].extend();
    });
};


