let mod = {

    SAY_ASSIGNMENT: true, // say a symbol representing the assiged action
    SAY_PUBLIC: true, // creeps talk public
    CENSUS_ANNOUNCEMENTS: true, // log birth and death
    DEBUG: true,
    DEBUG_STACKS: false, // add stack frame to EVERY console.log message (spammy!)
    PROFILE: true, // enable CPU profiling
    TRACE: true, // use Memory.debugTrace for low-level information
    PROFILING: {
        ANALYZE_LIMIT: 2, // profile warning levels
        AVERAGE_USAGE: true, // display average creep & flag usage
        BASIC_ONLY: false, // only display basic profiling information, disables all other profiling
        BEHAVIOUR: true, // profile behaviour action assignment
        CREEPS: true, // display creep profiling information
        CREEP_TYPE: '', // define a specific creep to profile, requires CREEPS=true
        EXECUTE_LIMIT: 5, // profile warning levels
        FLAGS: true, // display flag profiling information
        FLUSH_LIMIT: 5, // profile warning levels
        MAIN: true, // profile main loop
        MIN_THRESHOLD: 0.5, // set the bar for checks that involve very low usage (warning, chatty!)
        REGISTER_LIMIT: 2, // profile warning levels
        ROOMS: true, // display room and structure profiling information
        VISUALS: true, // profile visuals
        VISUALS_LIMIT: 0.2 // CPU usage in each part of visuals above this limit will be displayed
    },
    CRITICAL_BUCKET_LEVEL: 1000, // take action when the bucket drops below this value to prevent the bucket from actually running out
    CRITICAL_BUCKET_OVERFILL: 200,
    CRITICAL_ROLES: ['worker', 'collapseWorker', 'melee', 'ranger', 'healer', 'miner', 'hauler', 'upgrader'], // when the bucket drops below the critical bucket level only these creep roles will be executed

    TRAVELER_STUCK_TICKS: 2, // Number of ticks not moving to be considered stuck by the Traveler API
    TRAVELER_THRESHOLD: 5, // Average creep CPU usage/tick before warning about pathing cost, starts after 25 ticks
    ROUTE_ROOM_COST: { 'shard0': {}}, // custom room routing cost: e.g. `{'shard0':{ 'W0N0':5, 'W4N4': 11 },'shard1':...}`. Affects bestSpawnRoomFor, Creep.Setup calculations, and travel cost predictions. Please call 'delete Memory.routeRange;' whenever you change this property.


    SPAWN_INTERVAL: 5, // loops between regular spawn probe

    REMOTE_HAULER: {
        ALLOW_OVER_CAPACITY: 2450, // Hauler capacity rounds up by MIN_WEIGHT, or this number value.
        DRIVE_BY_BUILD_ALL: false, // If REMOTE_HAULER.DRIVE_BY_BUILDING is enabled then this option will allow remote haulers will drive-by-build any of your structures.
        DRIVE_BY_BUILD_RANGE: 1, // A creep's max build distance is 3 but cpu can be saved by dropping the search distance to 1.
        DRIVE_BY_BUILDING: true, // Allows remote haulers to build roads and containers. Consider setting REMOTE_WORKER_MULTIPLIER to 0.
        DRIVE_BY_REPAIR_RANGE: 0, // range that remote haulers should search when trying to repair and move
        MIN_LOAD: 0.75, // Haulers will return home as long as their ratio of carrying/capacity is above this amount.
        MIN_WEIGHT: 800, // Small haulers are a CPU drain.
        MULTIPLIER: 4, // Max number of haulers spawned per source in a remote mining room.
        REHOME: true // May haulers choose closer storage for delivery?
    },

    MINERS_AUTO_BUILD: true, // miners and remoteMiners will build their own containers if they are missing.



    MEMORY_RESYNC_INTERVAL: 500, // interval to reload spawns & towers present in a room

    // constants

    CRAYON: { // predefined log colors
        death: {color: 'black', 'font-weight': 'bold'},
        birth: '#e6de99',
        error: '#e79da7',
        system: {color: '#999', 'font-size': '12px'}
    },
    MEM_SEGMENTS: {
        COSTMATRIX_CACHE: {
            start: 99,
            end: 95
        }
    },
    FLAG_COLOR: {
        // COLOR_RED
        invade: { // destroy everything enemy in the room
            color: COLOR_RED,
            secondaryColor: COLOR_RED,
            exploit: { // send privateers to exploit sources
                color: COLOR_RED,
                secondaryColor: COLOR_GREEN
            },
            robbing: { // take energy from foreign structures
                color: COLOR_RED,
                secondaryColor: COLOR_YELLOW
            },
            attackController: { // attack enemy controller and then claim
                color: COLOR_RED,
                secondaryColor: COLOR_CYAN
            },
            powerMining: {
                color: COLOR_RED,
                secondaryColor: COLOR_BROWN
            },
            hopper: {
                color: COLOR_RED,
                secondaryColor: COLOR_PURPLE
            },
            hopperHome: {
                color: COLOR_RED,
                secondaryColor: COLOR_BLUE
            },
            attackTrain: {
                color: COLOR_RED,
                secondaryColor: COLOR_WHITE
            }
        },
        //COLOR_PURPLE - Reserved labs
        labs: { // could be used to define certain lab commands
            color: COLOR_PURPLE,
            secondaryColor: COLOR_PURPLE,
            filter: {'color': COLOR_PURPLE, 'secondaryColor': COLOR_PURPLE },
            labTech: { // spawn lab tech when required
                color: COLOR_PURPLE,
                secondaryColor: COLOR_WHITE,
                filter: {'color': COLOR_PURPLE, 'secondaryColor': COLOR_WHITE }
            }

        },
        //COLOR_BLUE - Train
        trainHeal: {
            color: COLOR_BLUE,
            secondaryColor: COLOR_GREEN
        },
        trainTurret: {
            color: COLOR_BLUE,
            secondaryColor: COLOR_WHITE
        },
        boostedTrain: {
            color: COLOR_BLUE,
            secondaryColor: COLOR_YELLOW
        },
        //COLOR_CYAN - Reserved (build related)
        construct: { // construct an extension at flag when available
            color: COLOR_CYAN,
            secondaryColor: COLOR_CYAN,
            spawn: { // construct a spawn at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_RED
            },
            tower: { // construct a tower at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_PURPLE
            },
            link: { // construct a link at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_BLUE
            },
            lab: { // construct a lab at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_GREEN
            },
            storage: { // construct a storage at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_YELLOW
            },
            terminal: { // construct a terminal at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_ORANGE
            },
            observer: { // construct an observer at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_BROWN
            },
            nuker: { // construct a nuker at flag when available
                color: COLOR_CYAN,
                secondaryColor: COLOR_GREY
            },
            powerSpawn: { // construct a power spawn at flagwhen available
                color: COLOR_CYAN,
                secondaryColor: COLOR_WHITE
            }
        },
        //COLOR_GREEN
        claim: { // claim this room, then build spawn at flag
            color: COLOR_GREEN,
            secondaryColor: COLOR_GREEN,
            spawn: { // send pioneers & build spawn here
                color: COLOR_GREEN,
                secondaryColor: COLOR_WHITE
            },
            pioneer: { // send additional pioneers
                color: COLOR_GREEN,
                secondaryColor: COLOR_RED
            },
            reserve: { // reserve this room
                color: COLOR_GREEN,
                secondaryColor: COLOR_GREY
            },
            mining: {
                color: COLOR_GREEN,
                secondaryColor: COLOR_BROWN
            },
            delivery: { // rob energy from friendly rooms and deliver here
                color: COLOR_GREEN,
                secondaryColor: COLOR_YELLOW
            },
            portal: {
                color: COLOR_GREEN,
                secondaryColor: COLOR_BLUE
            }
        },
        //COLOR_YELLOW
        defense: { // point to gather troops
            boosted: {
                color: COLOR_YELLOW,
                secondaryColor: COLOR_BLUE
            },
            color: COLOR_YELLOW,
            secondaryColor: COLOR_YELLOW
        },
        attackTrain: {
            color: COLOR_RED,
            secondaryColor: COLOR_WHITE
        },
        sourceKiller: {
            color: COLOR_YELLOW,
            secondaryColor: COLOR_RED
        },
        //COLOR_ORANGE
        destroy: { // destroy whats standing here
            color: COLOR_ORANGE,
            secondaryColor: COLOR_ORANGE,
            dismantle: {
                color: COLOR_ORANGE,
                secondaryColor: COLOR_YELLOW
            }
        },
        //COLOR_BROWN
        pavementArt: {
            color: COLOR_BROWN,
            secondaryColor: COLOR_BROWN
        },
        // COLOR_GREY
        sequence: {
            color: COLOR_GREY,
            secondaryColor: COLOR_GREY
        },
        // COLOR_WHITE
        command: { // command api
            color: COLOR_WHITE,
            drop: { // haulers drop energy in a pile here
                color: COLOR_WHITE,
                secondaryColor: COLOR_YELLOW
            },
            _OCS: {
                color: COLOR_WHITE,
                secondaryColor: COLOR_PURPLE
            },
            roomLayout: {
                color: COLOR_WHITE,
                secondaryColor: COLOR_CYAN
            },
            invalidPosition: {
                color: COLOR_WHITE,
                secondaryColor: COLOR_RED
            },
            skipRoom: {
                color: COLOR_WHITE,
                secondaryColor: COLOR_GREEN
            },
            idle: {
                color: COLOR_WHITE,
                secondaryColor: COLOR_BROWN
            },
            safeGen: {
                color: COLOR_WHITE,
                secondaryColor: COLOR_BLUE
            }
        }
    },
    CREEP_STATS: {
        creep: {
            coreParts: {
                [MOVE]: true,
                [HEAL]: true,
            },
            boost: {
                hits: {
                    [RESOURCE_GHODIUM_OXIDE]: 143,
                    [RESOURCE_GHODIUM_ALKALIDE]: 200,
                    [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: 334
                }
            }
        }
    }



};

module.exports = mod;
