global._ME = _(Game.rooms).map('controller').filter('my').map('owner.username').first();

let mod = {
    ME: _ME,
    CHATTY: false, // creeps say their current action
    HONK: true, // HONK when stored path is blocked by other creeps
    OOPS: true, // Creeps say Oops when dropping energy during dropmining
    SAY_ASSIGNMENT: true, // say a symbol representing the assiged action
    SAY_PUBLIC: true, // creeps talk public
    CENSUS_ANNOUNCEMENTS: false, // log birth and death
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
    TRAVELLING_BORDER_RANGE: 22, // room arrival distance for travelling and routes
    NOTIFICATE_INVADER: false, // Also log common 'Invader' hostiles
    NOTIFICATE_INTRUDER: false, // Log any hostiles in your rooms
    NOTIFICATE_HOSTILES: true, // Log any hostiles - Ignores NOTIFICATE_INTRUDER and NOTIFICATE_INVADER
    COST_MATRIX_VALIDITY: 1000,


    TIME_ZONE: 2, // zone offset in hours (-12 through +12) from UTC
    USE_SUMMERTIME: true, // Please define isSummerTime in global.js to suit to your local summertime rules

    CONSTRUCTION_PRIORITY: [STRUCTURE_SPAWN,STRUCTURE_EXTENSION,STRUCTURE_LINK,STRUCTURE_TERMINAL,STRUCTURE_STORAGE,STRUCTURE_TOWER,STRUCTURE_POWER_SPAWN,STRUCTURE_NUKER,STRUCTURE_OBSERVER,STRUCTURE_ROAD,STRUCTURE_CONTAINER,STRUCTURE_EXTRACTOR,STRUCTURE_LAB,STRUCTURE_WALL,STRUCTURE_RAMPART],



    SPAWN_INTERVAL: 5, // loops between regular spawn probe
    ROOM_VISUALS: true, // display basic room statistics with RoomVisuals
    ROOM_VISUALS_ALL: false, // displays visuals in all rooms you have vision in. Only your rooms when false.
    VISUALS: { // if ROOM_VISUALS is enabled, you can select what you want to display - All is a bit much for some people.
        VISIBLE_ONLY: false, // depends on userscript: https://github.com/Esryok/screeps-browser-ext/blob/master/visible-room-tracker.user.js
        ROOM: true, // displays basic info relative to the room
        ROOM_GLOBAL: true, // displays basic info relative to your account - requires ROOM: true
        INFO_PIE_CHART: true, // replaces the info bars with pie charts
        CPU: true, // display a graph containing CPU used, CPU limit, and bucket
        ROOM_ORDERS: true, // display orders the room creates
        ROOM_OFFERS: true, // display what a room will offer another
        SPAWN: true, // displays creep name and spawn progress percentage when spawning
        CONTROLLER: true, // displays level, progress, and ticks to downgrade if active
        STORAGE: true, // displays storage contents
        TERMINAL: true, // displays terminal contents
        TOWER: true, // displays tower contents
        TRANSACTIONS: true, // displays 2 most recent transactions over room terminal
        LABS: true, // displays lab energy, mineral, or cooldown
        MINERAL: true, // displays mineral amount, or ticks to regen
        SOURCE: true, // displays energy amount, or ticks to regen
        CREEP: true, // draws creep paths
        WALL: true, // highlight weakest wall and display hits
        RAMPART: true, // highlight weakest rampart and display hits
        ROAD: true, // highlight weakest road and display hits
        HEATMAP: true, // collects creep positioning to display a heatmap. WARNING: HIGH MEMORY USAGE
        HEATMAP_INTERVAL: 2, // intervals between collections
        ACTION_ASSIGNMENT: true, // draws a line from a creep and it's new assignment
        CONTAINER: true, // displays container amount of resources in x/2000 format
        DRAW_ARROW: true, // draw arrow to the target
        HIGHLIGHT_STRUCTURE: true // highlight target structure
    },

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
    MINER_WORK_THRESHOLD: 50, // how long to wait before a miner checks for repairs/construction sites nearby again

    ROAD_CONSTRUCTION_ENABLE: false, // Set to False to disable automatic road construction, or to a number to enable for owned rooms reaching that RC Level. WARNING: HIGH MEMORY USAGE
    ROAD_CONSTRUCTION_FORCED_ROOMS: {'shard0': []}, //Add room names to force automatic road construction regardless of ROAD_CONSTRUCTION_ENABLE e.g. {'shard0':['W0N0','W1N0'],'shard1':['W0N0', 'W1N0']}. No dependency with ROAD_CONSTRUCTION_ENABLE
    ROAD_CONSTRUCTION_INTERVAL: 500,
    ROAD_CONSTRUCTION_MIN_DEVIATION: 1.2,
    ROAD_CONSTRUCTION_ABS_MIN: 3,

    MANAGED_CONTAINER_TRIGGER: 0.25, // managed containers get filled below this relative energy amount and emptied when above 1-this value



    MEMORY_RESYNC_INTERVAL: 500, // interval to reload spawns & towers present in a room
    SEND_STATISTIC_REPORTS: true, // Set to true to receive room statistics per mail, otherwise set to false.
    COMPRESS_COST_MATRICES: false, // enable to compress cached cost matrices (1/5 the size, but currently about 2x CPU usage)
    COOLDOWN: {
        TOWER_URGENT_REPAIR: 10,
        TOWER_REPAIR: 10,
        CREEP_IDLE: 5
    },

    MAX_REPAIR_LIMIT: { // Limits how high structures get repaired by towers, regarding RCL
        1: 1000,
        2: 1000,
        3: 2000,
        4: 4000,
        5: 8000,
        6: 15000,
        7: 20000,
        8: 40000
    },
    MIN_FORTIFY_LIMIT: { // Minimum fortification level
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
        8: 1000000,     // focus is usually RCL growth, so 0 until 8
    },
    MAX_FORTIFY_LIMIT: { // Limits how high structures get repaired by creeps, regarding RCL
        1: 1000,
        2: 1000,
        3: 2000,
        4: 50000,
        5: 100000,
        6: 300000,
        7: 750000,
        8: 300000000
    },
    MAX_FORTIFY_CONTAINER: 50000,
    LIMIT_URGENT_REPAIRING: 750, // urgent repair when hits below
    GAP_REPAIR_DECAYABLE: 800, // decayables (e.g. roads) only get repaired when that much hits are missing

    // constants
    ACTION_SAY: { // what gets said on creep.action.*.onAssignment
        ATTACK_CONTROLLER: String.fromCodePoint(0x1F5E1) + String.fromCodePoint(0x26F3), // 🗡⛳
        AVOIDING: String.fromCodePoint(0x21A9), // ↩
        BOOSTING: String.fromCodePoint(0x1F4AA), // 💪🏼
        BUILDING: String.fromCodePoint(0x2692), // ⚒
        BULLDOZING: String.fromCodePoint(0x1F69C), // 🚜
        CHARGING: String.fromCodePoint(0x1F50C), // 🔌
        CLAIMING: String.fromCodePoint(0x26F3), // ⛳
        DEFENDING: String.fromCodePoint(0x2694), // ⚔
        DISMANTLING: String.fromCodePoint(0x1F527), // 🔧
        DROPPING: String.fromCodePoint(0x1F4A9), // 💩
        FEEDING: String.fromCodePoint(0x1F355), // 🍕
        FORTIFYING: String.fromCodePoint(0x1F528), // 🔨
        FUELING: String.fromCodePoint(0x26FD), // ⛽
        GUARDING: String.fromCodePoint(0x1F46E) + String.fromCodePoint(0x1F3FC), // 👮🏼
        HARVESTING: String.fromCodePoint(0x26CF), // ⛏
        HEALING: String.fromCodePoint(0x26E8), // ⛨
        IDLE: String.fromCodePoint(0x1F3B5), // 🎵
        INVADING: String.fromCodePoint(0x1F52B), // 🔫
        MINING: String.fromCodePoint(0x26CF), // ⛏
        PICKING: String.fromCodePoint(0x23EC), // ⏬
        REALLOCATING: String.fromCodePoint(0x2194), // ↔
        RECYCLING: String.fromCodePoint(0x267B), // ♻
        REPAIRING: String.fromCodePoint(0x1F528), // 🔨
        RESERVING: String.fromCodePoint(0x26F3), // ⛳
        ROBBING: String.fromCodePoint(0x1F480), // 💀
        STORING: String.fromCodePoint(0x1F4E5) + String.fromCodePoint(0xFE0E), // 📥
        TRAVELLING: String.fromCodePoint(0x1F3C3), // 🏃
        UNCHARGING: String.fromCodePoint(0x1F50B), // 🔋
        UPGRADING: String.fromCodePoint(0x1F5FD), // 🗽
        WITHDRAWING: String.fromCodePoint(0x1F4E4) + String.fromCodePoint(0xFE0E), // 📤
        SAFEGEN: String.fromCodePoint(0x1F512) // 🔒
    },

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
    },
    DECAY_AMOUNT: {
        'rampart': RAMPART_DECAY_AMOUNT, // 300
        'road': ROAD_DECAY_AMOUNT, // 100
        'container': CONTAINER_DECAY // 5000
    },
    DECAYABLES: [
        STRUCTURE_ROAD,
        STRUCTURE_CONTAINER,
        STRUCTURE_RAMPART
        ],
    PART_THREAT: {
        'move': { common: 0, boosted: 0 },
        'work': { common: 1, boosted: 3 },
        'carry': { common: 0, boosted: 0 },
        'attack': { common: 2, boosted: 5 },
        'ranged_attack': { common: 2, boosted: 5 },
        'heal': { common: 4, boosted: 10 },
        'claim': { common: 1, boosted: 3 },
        'tough': { common: 1, boosted: 3 },
        tower: 25
    },

};

module.exports = mod;
