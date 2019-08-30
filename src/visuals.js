"use strict";


const
    BLACK = '#000000',
    WHITE = '#FFFFFF',
    RED = '#FF0000',
    GREEN = '#00FF00',
    BLUE = '#0000FF',
    YELLOW = '#FFFF00',
    CYAN = '#00FFFF';

let getColourByPercentage = (percentage, reverse) => {
    const value = reverse ? percentage : 1 - percentage;
    const hue = (value * 120).toString(10);
    return `hsl(${hue}, 100%, 50%)`;
};

let getResourceColour = (resourceType) => {
    let BASE = {
        [RESOURCE_ENERGY]: '#FFE56D',
        [RESOURCE_POWER]: RED,
        [RESOURCE_CATALYST]: '#FF7A7A',
        [RESOURCE_GHODIUM]: WHITE,
        [RESOURCE_HYDROGEN]: '#CCCCCC',
        [RESOURCE_KEANIUM]: '#9370FF',
        [RESOURCE_LEMERGIUM]: '#89F4A5',
        [RESOURCE_OXYGEN]: '#CCCCCC',
        [RESOURCE_UTRIUM]: '#88D6F7',
        [RESOURCE_ZYNTHIUM]: '#F2D28B'
    };

    let colour = BASE[resourceType];

    if (colour) return colour;

    let compoundType = [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_GHODIUM, RESOURCE_HYDROGEN, RESOURCE_OXYGEN].find(type => resourceType.includes(type));
    return BASE[compoundType];
};

let storageObject = (vis, store, x, startY) => {
    Object.keys(store).forEach(resource => vis.text(`${resource}: ${global.Util.formatNumber(store[resource])}`, x, startY += 0.6, Object.assign({color: getResourceColour(resource)}, {align: 'left', font: 0.5})));
};

let Visuals = class {

    // VISUAL UTIL METHODS
    drawBar(vis, val, x, y, width, height, inner, fillStyle={}) {
        if (!inner)
            inner = val;
        const TEXT_Y = y + 0.75;
        vis.rect(x, y, width, height, this.barStyle);
        vis.rect(x, y, width * val, height, fillStyle);
        vis.text(inner, x + width / 2, TEXT_Y);
    }

    drawPie(vis, val, max, title, colour, center, inner) {

        if (!inner)
            inner = val;

        let p = 1,
            r = 1; // radius

        if (max !== 0)
            p = val / max;

        center = {x: center.x, y: center.y * r * 4.5};
        vis.circle(center, {
            radius: r + 0.1,
            fill: BLACK,
            stroke: 'rgba(255, 255, 255, 0.8)'
        });
        let poly = [center],
            tau = 2 * Math.PI,
            surf = tau * (p + 0.1),
            offs = -Math.PI / 2,
            step = tau / 32;

        for (let i = 0; i <= surf; i += step) {
            poly.push({
                x: center.x + Math.cos(i + offs),
                y: center.y - Math.cos(i)
            });
        }
        poly.push(center);
        vis.poly(poly, {
            fill: colour,
            opacity: 1,
            stroke: colour,
            strokeWidth: 0.05
        });
        vis.text(Number.isFinite(inner) ? global.Util.formatNumber(inner) : inner, center.x, center.y + 0.33, {
            color: WHITE,
            font: '1 monospace',
            align: 'center',
            stroke: 'rgba(0, 0, 0, 0.8)',
            strokeWidth: 0.08
        });
        let yOff = 0.7,
            lastPol = poly[poly.length - 2];
        if (0.35 < p && p < 0.65)
            yOff += 0.3;
        vis.text(title, center.x, center.y + r + yOff, {
            color: WHITE,
            font: '0.6 monospace',
            align: 'center'
        });

        vis.text(`${Math.floor(p * 100)}%`, lastPol.x + (lastPol.x - center.x) * 0.7, lastPol.y + (lastPol.y - center.y) * 0.4 + 0.1, {
            color: WHITE,
            font: '0.4 monospace',
            align: 'center'
        });
    }

    drawLine(from, to, style) {

        if (from instanceof RoomObject)
            from = from.pos;
        if (to instanceof RoomObject)
            to = to.pos;
        if (!(from instanceof RoomPosition || to instanceof RoomPosition))
            throw new Error('Visuals: Point not a RoomPosition');
        if (from.roomName !== to.roomName)
            return; // cannot draw lines to another room
        let vis = new RoomVisual(from.roomName);
        style = style instanceof Creep ? this.creepPathStyle(style) : (style || {});
        vis.line(from, to, style);
    }

    drawArrow (from, to, style) {

        if (from instanceof RoomObject)
            from = from.pos;
        if (to instanceof RoomObject)
            to = to.pos;
        if (!(from instanceof RoomPosition || to instanceof RoomPosition))
            throw new Error('Visuals: Point not a RoomPosition');
        if (from.roomName !== to.roomName)
            return; // cannot draw lines to another room
        let vis = new RoomVisual(from.roomName);

        if (global.VISUALS.DRAW_ARROW && global.ROOM_VISUALS) {

            this.drawLine(from, to, style);

            let delta_x = from.x - to.x,
                delta_y = from.y - to.y,
                theta_radians = Math.atan2(delta_y, delta_x),
                base_angle = 0.610865,
                length = Math.log1p(global.Util.getDistance(from, to)) * 0.5;

            style = style instanceof Creep ? this.creepPathStyle(style) : (style || {});

            vis.line(to.x, to.y, to.x + length * Math.cos(theta_radians + base_angle), to.y + length * Math.sin(theta_radians + base_angle), style);
            vis.line(to.x, to.y, to.x + length * Math.cos(theta_radians - base_angle), to.y + length * Math.sin(theta_radians - base_angle), style);
        }

        function getStructure(to) {
            let structures = to.lookFor(LOOK_STRUCTURES);
            if (!_.isUndefined(structures[0]))
                return structures[0];
            else
                return null;
        }

        if (global.VISUALS.HIGHLIGHT_STRUCTURE && global.ROOM_VISUALS) {

            let targetStructure = getStructure(to);

            if (targetStructure === null) {
                vis.structure(to.x, to.y, null);
            } else
                vis.structure(targetStructure.pos.x, targetStructure.pos.y, targetStructure.structureType);

        }
    }

    constructor() {
        this.barStyle = {fill: '#2B2B2B', opacity: 0.8, stroke: BLACK};
        this.sparklineStyle = [
            {
                key: 'limit',
                min: Game.cpu.limit * 0.5,
                max: Game.cpu.limit * 1.5,
                stroke: '#808080',
                opacity: 0.25
            }, {
                key: 'cpu',
                min: Game.cpu.limit * 0.5,
                max: Game.cpu.limit * 1.5,
                stroke: YELLOW,
                opacity: 0.5
            }, {
                key: 'bucket',
                min: 0,
                max: 10000,
                stroke: CYAN,
                opacity: 0.5
            }
        ];
        this.toolTipStyle = {align: 'left', font: 0.4};
        this.weakestStyle = {radius: 0.4, fill: RED, opacity: 0.3, strokeWidth: 0};
        this.vis = new RoomVisual;
    }

    run() {
        let p = global.Util.startProfiling('Visuals', {enabled: global.PROFILING.VISUALS});

        _.forEach(Object.keys(Game.rooms), roomName => {

            let room = Game.rooms[roomName],
                p2 = global.Util.startProfiling('Visuals: ' + room.name, {enabled: global.PROFILING.VISUALS});

            if (!room)
                return;
            if (!global.ROOM_VISUALS_ALL && !room.my)
                return;

            global.Util.set(Memory, 'heatmap', false);

            if (global.VISUALS.HEATMAP) {
                if (Game.time % global.VISUALS.HEATMAP_INTERVAL === 0) {
                    this.setHeatMapData(room);
                    p2.checkCPU('Heatmap.set', global.PROFILING.VISUALS_LIMIT);
                }

                if (Memory.heatmap) {
                    this.drawHeatMapData(room);
                    p2.checkCPU('Heatmap.draw', global.PROFILING.VISUALS_LIMIT);
                    return;
                }
            }

            if (global.VISUALS.ROOM && !!room.controller) {
                this.drawRoomInfo(room, global.VISUALS.ROOM_GLOBAL);
                p2.checkCPU('Room Info', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.ROOM_ORDERS) {
                this.drawRoomOrders(room);
                p2.checkCPU('Room Orders', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.ROOM_OFFERS) {
                this.drawRoomOffers(room);
                p2.checkCPU('Room Offers', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.CONTROLLER) {
                this.drawControllerInfo(room.controller);
                p2.checkCPU('Controller', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.SPAWN) {
                room.structures.spawns.filter(s => s.spawning).forEach(spawn => this.drawSpawnInfo(spawn));
                p2.checkCPU('Spawns', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.MINERAL) {
                let [mineral] = room.minerals;
                if (mineral) {
                    this.drawMineralInfo(mineral);
                    p2.checkCPU('Mineral', global.PROFILING.VISUALS_LIMIT);
                }
            }
            if (global.VISUALS.SOURCE) {
                room.sources.forEach(source => this.drawSourceInfo(source));
                p2.checkCPU('Sources', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.WALL) {
                this.highlightWeakest(room, STRUCTURE_WALL);
                p2.checkCPU('Walls', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.RAMPART) {
                this.highlightWeakest(room, STRUCTURE_RAMPART);
                p2.checkCPU('Ramparts', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.ROAD) {
                this.highlightWeakest(room, STRUCTURE_ROAD);
                p2.checkCPU('Roads', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.STORAGE) {
                this.drawStorageInfo(room.storage);
                p2.checkCPU('Storage', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.TERMINAL) {
                this.drawTerminalInfo(room.terminal);
                p2.checkCPU('Terminal', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.TRANSACTIONS) {
                this.drawTransactions(room);
                p2.checkCPU('Transactions', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.LABS) {
                room.structures.labs.all.forEach(lab => this.drawLabInfo(lab));
                p2.checkCPU('Labs', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.CREEP) {
                //console.log(`Hello creep Path`);
                room.creeps.forEach(creep => this.drawCreepPath(creep));
                p2.checkCPU('Creep Paths', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.TOWER) {
                room.structures.towers.forEach(tower => this.drawTowerInfo(tower));
                p2.checkCPU('Towers', global.PROFILING.VISUALS_LIMIT);
            }
            if (global.VISUALS.CONTAINER) {
                room.structures.container.all.forEach(container => this.drawContainerInfo(container));
                p2.checkCPU('Containers', global.PROFILING.VISUALS_LIMIT);
            }
        });
        p.checkCPU('Total for all rooms', global.PROFILING.VISUALS_LIMIT);
        if (global.VISUALS.ROOM_GLOBAL) {
            if (global.VISUALS.CPU) {
                this.collectSparklineStats();
                p.checkCPU('CPU Sparklines', global.PROFILING.VISUALS_LIMIT);
            }
            this.drawGlobal();
            p.checkCPU('Global', global.PROFILING.VISUALS_LIMIT);
        }
    }

    drawGlobal() {

        //console.log(`Hello GLOBAL VIS`);

        const vis = this.vis;
        const bufferWidth = 1;
        if (!global.VISUALS.INFO_PIE_CHART) {
            const sectionWidth = 49 / 5;
            const BAR_STYLE = this.barStyle;

            let x = bufferWidth;
            let y = 2;
            const BAR_Y = y - 0.75;
            if (global.VISUALS.ROOM) {
                // GCL
                x = bufferWidth * 2 + sectionWidth;
                const GCL_PERCENTAGE = Game.gcl.progress / Game.gcl.progressTotal;
                this.drawBar(vis, GCL_PERCENTAGE, x, BAR_Y, sectionWidth, 1, `GCL: ${Game.gcl.level} (${(GCL_PERCENTAGE * 100).toFixed(2)}%)`, {
                    fill: getColourByPercentage(GCL_PERCENTAGE, true),
                    opacity: BAR_STYLE.opacity
                });

                // CPU
                x += sectionWidth + bufferWidth;
                const CPU_PERCENTAGE = Game.cpu.getUsed() / Game.cpu.limit;
                const FUNCTIONAL_CPU_PERCENTAGE = Math.min(1, CPU_PERCENTAGE);
                this.drawBar(vis, FUNCTIONAL_CPU_PERCENTAGE, x, BAR_Y, sectionWidth, 1, `CPU: ${(CPU_PERCENTAGE * 100).toFixed(2)}%`, {
                    fill: getColourByPercentage(FUNCTIONAL_CPU_PERCENTAGE),
                    opacity: BAR_STYLE.opacity
                });

                // BUCKET
                x += sectionWidth + bufferWidth;
                const BUCKET_PERCENTAGE = Math.min(1, Game.cpu.bucket / 10000);
                this.drawBar(vis, BUCKET_PERCENTAGE, x, BAR_Y, sectionWidth, 1, `Bucket: ${Game.cpu.bucket}`, {
                    fill: getColourByPercentage(BUCKET_PERCENTAGE, true),
                    opacity: BAR_STYLE.opacity
                });

                // TICK
                x += sectionWidth + bufferWidth;
                vis.text(`Tick: ${Game.time}`, x, y, {align: 'left'});

                //  Second Row
                x = bufferWidth * 2 + sectionWidth;
                y += 1.5;

                //  SPAWN CAPACITY UTILIZATION (SCU)
                const spawnCount = _.size(Game.spawns);
                let count = _(Game.spawns).filter('spawning').size();
                count += _(Game.rooms).map(r => r.spawnQueueHigh.concat(r.spawnQueueMedium, r.spawnQueueLow)).flatten().size();
                const SCU_PERCENTAGE = count / spawnCount;
                this.drawBar(vis, Math.min(1, SCU_PERCENTAGE), x, y - 0.75, sectionWidth, 1, `SCU: ${(SCU_PERCENTAGE * 100).toFixed(2)}%`, {
                    fill: getColourByPercentage(Math.min(1, SCU_PERCENTAGE)),
                    opacity: BAR_STYLE.opacity
                });
            }
        } else {
            let x = bufferWidth + 1;
            let y = 0.5;
            // GCL
            this.drawPie(vis, Math.round(Game.gcl.progress), Game.gcl.progressTotal, `GCL ${Game.gcl.level}`, getColourByPercentage(Game.gcl.progress / Game.gcl.progressTotal, true), {x, y: y++});

            // CPU
            const CPU_PERCENTAGE = Game.cpu.getUsed() / Game.cpu.limit;
            const FUNCTIONAL_CPU_PERCENTAGE = Math.min(1, CPU_PERCENTAGE);
            this.drawPie(vis, Math.round(Game.cpu.getUsed()), Game.cpu.limit, 'CPU', getColourByPercentage(FUNCTIONAL_CPU_PERCENTAGE), {x, y: y++});

            // BUCKET
            this.drawPie(vis, Game.cpu.bucket, 10000, 'Bucket', getColourByPercentage(Math.min(1, Game.cpu.bucket / 10000), true), {x, y: y++});

            //  SPAWN CAPACITY UTILIZATION (SCU)
            const spawnCount = _.size(Game.spawns);
            let count = _(Game.spawns).filter('spawning').size();
            count += _(Game.rooms).map(r => r.spawnQueueHigh.concat(r.spawnQueueMedium, r.spawnQueueLow)).flatten().size();
            const SCU_PERCENTAGE = count / spawnCount;
            this.drawPie(vis, SCU_PERCENTAGE, 1, 'SCU', getColourByPercentage(SCU_PERCENTAGE), {x, y: y++});

            // TICK
            y += 15;
            vis.text('Tick', x, y++, {
                color: WHITE,
                align: 'center'
            });
            vis.text(Game.time, x, y++, {
                color: WHITE,
                align: 'center'
            });
        }
        if (global.VISUALS.CPU) {
            this.drawSparkline(undefined, 1.5, 46.5, 20, 2, _.map(Memory.visualStats.cpu, (v, i) => Memory.visualStats.cpu[i]), this.sparklineStyle);
        }
    }

    collectSparklineStats() {
        global.Util.set(Memory, 'visualStats.cpu', []);
        Memory.visualStats.cpu.push({
            limit: Game.cpu.limit,
            bucket: Game.cpu.bucket,
            cpu: Game.cpu.getUsed()
        });
        if (Memory.visualStats.cpu.length >= 100) {
            Memory.visualStats.cpu.shift();
        }
    }

    drawSparkline(room, x, y, w, h, values, opts) {
        const vis = room ? new RoomVisual(room) : this.vis;
        _.forEach(opts, opt => {
            vis.poly(_.map(values, (v, i) => [x + w * (i / (values.length - 1)), y + h * (1 - (v[opt.key] - opt.min) / (opt.max - opt.min))]), opt);
        });
    }

    drawRoomInfo(room) {
        const vis = new RoomVisual(room.name);
        let x;
        let y = 0;
        // Room Name: centered middle
        vis.text(`Room: ${vis.roomName}`, 24.5, ++y);
        // Displays bars: RCL, Room Energy
        const bufferWidth = 1;
        if (!global.VISUALS.INFO_PIE_CHART) {
            const sectionWidth = 49 / 5;
            const BAR_STYLE = this.barStyle;

            // RCL
            x = bufferWidth;
            y++;
            let text;
            let RCL_PERCENTAGE;
            if (room.controller.level === 8) {
                RCL_PERCENTAGE = 1;
                text = 'RCL: 8';
            } else if (room.controller.reservation) {
                RCL_PERCENTAGE = 0;
                text = `Reserved: ${room.controller.reservation.ticksToEnd}`;
            } else if (room.controller.owner) {
                RCL_PERCENTAGE = Math.min(1, room.controller.progress / room.controller.progressTotal);
                text = `RCL: ${room.controller.level} (${(RCL_PERCENTAGE * 100).toFixed(2)}%)`;
            } else {
                RCL_PERCENTAGE = 0;
                text = `Unowned`;
            }
            this.drawBar(vis, RCL_PERCENTAGE, x, y - 0.75, sectionWidth, 1, text, {
                fill: getColourByPercentage(RCL_PERCENTAGE, true),
                opacity: BAR_STYLE.opacity
            });

            if (global.VISUALS.ROOM_GLOBAL) {
                // New line
                y += 1.5;

                x = bufferWidth;
            } else {
                x += sectionWidth + bufferWidth;
            }

            // Display Energy Available
            if (!room.controller.reservation && room.controller.owner) {
                const ENERGY_PERCENTAGE = room.energyAvailable / room.energyCapacityAvailable || 0;
                this.drawBar(vis, ENERGY_PERCENTAGE, x, y - 0.75, sectionWidth, 1, `Energy: ${room.energyAvailable}/${room.energyCapacityAvailable} (${(ENERGY_PERCENTAGE * 100).toFixed(2)}%)`, {
                    fill: getColourByPercentage(ENERGY_PERCENTAGE, true),
                    opacity: BAR_STYLE.opacity
                });
            }
        } else {
            let x = bufferWidth + 1;
            let y = 0.5;
            if (global.VISUALS.ROOM_GLOBAL) {
                x += 4;
            }

            // RCL
            let val;
            let max;
            let title = 'RCL';
            let inner;
            if (room.controller.level === 8) {
                val = 1;
                max = 1;
                inner = ' ';
            } else if (room.controller.reservation) {
                val = room.controller.reservation.ticksToEnd;
                max = 5000;
            } else if (room.controller.owner) {
                val = Math.min(room.controller.progress, room.controller.progressTotal);
                max = room.controller.progressTotal;
                title += ` ${room.controller.level}`;
            } else {
                val = 0;
                max = 1;
                inner = 'N/A';
            }
            this.drawPie(vis, val, max, title, getColourByPercentage(val / max, true), {x, y: y++}, inner);

            // Energy Available
            if (!room.controller.reservation && room.controller.owner) {
                const PERCENTAGE = room.energyAvailable / room.energyCapacityAvailable || 0;
                this.drawPie(vis, room.energyAvailable, room.energyCapacityAvailable, 'Energy', getColourByPercentage(PERCENTAGE, true), {x, y: y++});
            }
        }
    }

    drawSpawnInfo(spawn) {
        if (!spawn.spawning) return;
        const vis = new RoomVisual(spawn.room.name);
        vis.text(`${spawn.spawning.name} (${((spawn.spawning.needTime - spawn.spawning.remainingTime) / spawn.spawning.needTime * 100).toFixed(1)}%)`, spawn.pos.x + 1, spawn.pos.y - 0.5, this.toolTipStyle);
    }

    drawMineralInfo(mineral) {
        const vis = new RoomVisual(mineral.room.name);
        const x = mineral.pos.x + 1;
        const y = mineral.pos.y - 0.5;
        if (mineral.mineralAmount) {
            vis.text(`Amount: ${global.Util.formatNumber(mineral.mineralAmount)}`, x, y, this.toolTipStyle);
        } else {
            vis.text(`Regen: ${global.Util.formatNumber(mineral.ticksToRegeneration)}`, x, y, this.toolTipStyle);
        }
    }

    drawSourceInfo(source) {
        const vis = new RoomVisual(source.room.name);
        const x = source.pos.x + 1;
        const y = source.pos.y - 0.5;
        if (source.energy) {
            vis.text(`Amount: ${source.energy}`, x, y, this.toolTipStyle);
        } else {
            vis.text(`Regen: ${source.ticksToRegeneration}`, x, y, this.toolTipStyle);
        }
    }

    drawControllerInfo(controller) {
        const vis = new RoomVisual(controller.room.name);
        const BASE_X = controller.pos.x + 1;
        let y = controller.pos.y - 0.5;
        const style = this.toolTipStyle;
        let line0 = `L: ${controller.level}`;
        let line1 = `P: ${global.Util.formatNumber(controller.progress)}/${global.Util.formatNumber(controller.progressTotal)} (${(controller.progress / controller.progressTotal * 100).toFixed(2)}%)`;
        let line2 = `D: ${global.Util.formatNumber(controller.ticksToDowngrade)}`;
        if (controller.level === 8) {
            line1 = undefined;
        } else if (controller.reservation) {
            line0 = 'L: Reserved';
            line1 = `P: ${controller.reservation.username}`;
            line2 = `D: ${controller.reservation.ticksToEnd}`;
        } else if (!controller.owner) {
            return;
        }
        vis.text(line0, BASE_X, y, style);
        if (line1) {
            vis.text(line1, BASE_X, y += 0.4, style);
        }
        if (controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[controller.level] || controller.reservation) {
            let downgradeStyle = Object.assign({}, style, {color: RED});
            vis.text(line2, BASE_X, y += 0.4, downgradeStyle);
        }
    }

    highlightWeakest(room, structureType) {
        const vis = new RoomVisual(room.name);
        const weakest = _(room.find(FIND_STRUCTURES)).filter({structureType}).min('hits');
        if (weakest && weakest.pos) {
            vis.circle(weakest.pos.x, weakest.pos.y, this.weakestStyle);
            let y = weakest.pos.y - 0.5; // base y pos - consistent with spawns, labs, and controllers
            const look = weakest.pos.lookFor(LOOK_STRUCTURES);
            const towers = _.find(look, o => o instanceof StructureTower);
            if (towers && global.VISUALS.TOWER) {
                y += 0.4;
            } else {
                const spawns = _.find(look, o => o instanceof StructureSpawn && o.spawning);
                if (spawns && global.VISUALS.SPAWN) {
                    // if structure shares a position with a spawn (road, rampart), lower to next line
                    // spawn must be spawning, and spawn visuals must be enabled
                    y += 0.4;
                } else {
                    const labs = _.find(look, o => o instanceof StructureLab);
                    if (labs && global.VISUALS.LABS) {
                        // same as spawns, move the weakest structure text until it's on its own line
                        if (labs.energy) y += 0.4;
                        if (labs.mineralAmount) y += 0.4;
                        if (labs.cooldown) y += 0.4;
                    }
                }
            }
            vis.text(`H: ${global.Util.formatNumber(weakest.hits)} (${(weakest.hits / weakest.hitsMax * 100).toFixed(2)}%)`, weakest.pos.x + 1, y, this.toolTipStyle);
        }
    }

    drawRoomOrders(room) {
        const vis = new RoomVisual(room.name);
        const x = 43;
        let y = global.VISUALS.INFO_PIE_CHART ? 0.5 : 4.5;
        if (!room.memory.resources || !room.memory.resources.orders || !_.size(room.memory.resources.orders)) {
            return;
        }

        if (global.VISUALS.STORAGE && room.storage) {
            y += 2 + _.size(room.storage.store) * 0.6;
        }
        if (global.VISUALS.TERMINAL && room.terminal) {
            y += 2 + _.size(room.terminal.store) * 0.6;
        }
        vis.text('Room Orders', x, ++y, {align: 'left'});
        for (let order of room.memory.resources.orders) {
            vis.text(`${order.type}: ${global.Util.formatNumber(order.amount)}`, x, y += 0.6, Object.assign({color: getResourceColour(order.type)}, this.toolTipStyle));
        }
    }

    drawRoomOffers(room) {
        const vis = new RoomVisual(room.name);
        const x = 43;
        let y = global.VISUALS.INFO_PIE_CHART ? 0.5 : 4.5;
        if (!room.memory.resources || !room.memory.resources.offers || !_.size(room.memory.resources.offers)) {
            return;
        }
        if (global.VISUALS.STORAGE && room.storage) {
            y += 2 + _.size(room.storage.store) * 0.6;
        }
        if (global.VISUALS.TERMINAL && room.terminal) {
            y += 2 + _.size(room.terminal.store) * 0.6;
        }
        if (global.VISUALS.ROOM_ORDERS && room.memory.resources.orders) {
            y += 2 + _.size(room.memory.resources.orders) * 0.6;
        }
        vis.text('Room Offerings', x, ++y, {align: 'left'});
        for (let offer of room.memory.resources.offers) {
            vis.text(`${offer.type}: ${global.Util.formatNumber(offer.amount)} (to ${offer.room})`, x, y += 0.6, Object.assign({color: getResourceColour(offer.type)}, this.toolTipStyle));
        }
    }

    drawStorageInfo(storage) {
        if (!storage || !_.size(storage.store)) return;
        const vis = new RoomVisual(storage.room.name);
        const x = 43;
        let y = global.VISUALS.INFO_PIE_CHART ? 0.5 : 4.5;
        vis.text('Storage Contents', x, ++y, {align: 'left'});
        storageObject(vis, storage.store, x, y);
    }

    drawTerminalInfo(terminal) {
        if (!terminal || !_.size(terminal.store)) return;
        const vis = new RoomVisual(terminal.room.name);
        const x = 43;
        let y = global.VISUALS.INFO_PIE_CHART ? 0.5 : 4.5;
        if (global.VISUALS.STORAGE && terminal.room.storage) {
            y += 2 + _.size(terminal.room.storage.store) * 0.6;
        }
        vis.text('Terminal Contents', x, ++y, {align: 'left'});
        storageObject(vis, terminal.store, x, y);
    }

    drawTransactions(room) {
        if (!room.terminal) return;
        const vis = new RoomVisual(room.name);
        const x = room.terminal.pos.x;
        let y = room.terminal.pos.y - 1;

        const transactions = _(Game.market.incomingTransactions)
            .concat(Game.market.outgoingTransactions)
            .filter(transaction => transaction.from === room.name || transaction.to === room.name)
            .sortByOrder('time', 'desc')
            .slice(0, 2)
            .value();

        if (transactions.length === 0) return;
        if (transactions.length === 2) y -= 0.4;

        transactions.forEach(transaction => {
            const outgoing = transaction.sender.username === room.controller.owner.username;
            const toSelf = transaction.recipient ? transaction.sender.username === transaction.recipient.username : false;
            const receiving = room.name === transaction.to;
            const colour = outgoing || receiving ? GREEN : RED;
            const prefix = outgoing ? '+' : '-';
            let text = '';
            if (toSelf || !transaction.order) {
                const roomName = receiving ? transaction.from : transaction.to;
                text = `${roomName} : ${transaction.amount} ${transaction.resourceType}`;
            } else {
                text = `${prefix}${transaction.amount * transaction.order.price}`;
            }
            vis.text(text, x, y, {font: this.toolTipStyle.font, color: colour});

            y += 0.4;
        });
    }

    drawLabInfo(lab) {
        const vis = new RoomVisual(lab.room.name);
        if (!lab.energy && !lab.mineralAmount && !lab.cooldown) return;
        const x = lab.pos.x + 0.8;
        let y = lab.pos.y - 0.5;
        if (lab.energy) {
            vis.text(`E: ${global.Util.formatNumber(lab.energy)}`, x, y, Object.assign({color: getResourceColour(RESOURCE_ENERGY)}, this.toolTipStyle));
        }
        if (lab.mineralAmount) {
            vis.text(`M: ${lab.mineralType} (${global.Util.formatNumber(lab.mineralAmount)})`, x, y += 0.4, Object.assign({color: getResourceColour(lab.mineralType)}, this.toolTipStyle));
        }
        if (lab.cooldown) {
            vis.text(`C: ${lab.cooldown}`, x, y += 0.4, Object.assign({color: RED}, this.toolTipStyle));
        }
    }

    setHeatMapData(room) {
        global.Util.set(room.memory, 'heatmap', () => {
            const r = {};
            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    let terrain = Game.map.getRoomTerrain(room.name);
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL)
                        continue;
                    const key = `${String.fromCharCode(32 + x)}${String.fromCharCode(32 + y)}_x${x}-y${y}`;
                    r[key] = 0;
                }
            }
            return r;
        });
        room.creeps.filter(creep => !creep.spawning).forEach(creep => {
            const x = creep.pos.x;
            const y = creep.pos.y;
            const key = `${String.fromCharCode(32 + x)}${String.fromCharCode(32 + y)}_x${x}-y${y}`;
            room.memory.heatmap[key]++;
        });
    }

    drawHeatMapData(room) {
        const vis = new RoomVisual(room.name);
        const data = Object.keys(room.memory.heatmap).map(k => {
            return {
                n: room.memory.heatmap[k],
                x: k.charCodeAt(0) - 32,
                y: k.charCodeAt(1) - 32
            };
        });

        const MAP_DATA = _.filter(data, d => d.n > 0);

        const PERCENTAGE_MAX = _.sum(MAP_DATA, d => d.n) / MAP_DATA.length * 2;
        MAP_DATA.forEach(d => {
            const PERCENTAGE = d.n / PERCENTAGE_MAX;
            const colour = getColourByPercentage(Math.min(1, PERCENTAGE));
            vis.rect(d.x - 0.5, d.y - 0.5, 1, 1, {fill: colour});
        });
    }

    drawTowerInfo(tower) {
        const vis = new RoomVisual(tower.room.name);
        vis.text(`E: ${tower.energy}/${tower.energyCapacity}`, tower.pos.x + 1, tower.pos.y - 0.5, this.toolTipStyle);
    }

    creepPathStyle(creep) {
        function randomColour() {
            let c = '#';
            while (c.length < 7) c += Math.random().toString(16).substr(-7).substr(-1);
            return c;
        }

        global.Util.set(creep.data, 'pathColour', randomColour);

        return {
            width: 0.15,
            color: creep.data.pathColour,
            lineStyle: 'dashed'
        };
    }

    drawCreepPath(creep) {
        let vis = new RoomVisual(creep.room.name);
        if (creep.action && creep.action.name === 'idle')
            return; // don't draw idle path
        if (_(creep.pos).pick(['x', 'y']).eq(creep.data.determinatedSpot))
            return;
        if (!creep.memory || !creep.memory._travel || !creep.memory._travel.path)
            return;

        let path = creep.memory._travel.path.substr(1),
            style = this.creepPathStyle(creep),
            x = creep.pos.x,
            y = creep.pos.y,
            maths = {
            [TOP]: {x: 0, y: -1},
            [TOP_RIGHT]: {x: 1, y: -1},
            [RIGHT]: {x: 1, y: 0},
            [BOTTOM_RIGHT]: {x: 1, y: 1},
            [BOTTOM]: {x: 0, y: 1},
            [BOTTOM_LEFT]: {x: -1, y: 1},
            [LEFT]: {x: -1, y: 0},
            [TOP_LEFT]: {x: -1, y: -1}
        };
        if (creep.fatigue === 0) {
            let initDir = +creep.memory._travel.path[0]; // get initial so we know where to set the start (x, y)
            x += maths[initDir].x;
            y += maths[initDir].y;
        }
        for (let dir of path) {
            dir = +dir; // force coerce to number
            vis.line(x, y, x += maths[dir].x, y += maths[dir].y, style);

        }
    }

    drawContainerInfo(container) {
        const vis = new RoomVisual(container.room.name);
        vis.text(`${_.sum(container.store)}/2000`, container.pos.x + 1, container.pos.y - 1, this.toolTipStyle);
    }

};
module.exports = new Visuals;
