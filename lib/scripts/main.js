import { world, system } from "@minecraft/server";
import { updatePhaseConfig, updatePhaseEndConfig } from "./phase-mode";
import { startHeadDetection } from "./phase-head-detector";
import { startPathPushing } from "./path-pushing";
import { startPhantomSpawner } from "./phase-spawner";
let ticksSinceLoad = 0;
function mainTick() {
    ticksSinceLoad++;
    if (ticksSinceLoad === 60) {
        world.sendMessage("§6Phantom Phase system initialized...");
        updatePhaseConfig({
            speedThresholdBps: 25.0,
            exitSpeedThresholdBps: 7.0,
            inactiveFramesThreshold: 20,
            debugMessages: true,
            preserveInventory: true,
            phaseBlockCheckDistance: 10,
            alwaysUseSpectator: false,
            spectatorBlockCheckInterval: 5,
        });
        // Configure phase-end effects
        updatePhaseEndConfig({
            explosionPower: 50.0, // Default TNT-sized explosion
            explosionBreaksBlocks: true, // Don't break blocks by default
            levitationDuration: 3, // 3 seconds of levitation
            levitationAmplifier: 2, // Level 3 (moderate height)
            resistanceDuration: 10, // 10 seconds of resistance
            resistanceAmplifier: 4, // Level 5 (max resistance)
            fireResistanceDuration: 10, // 10 seconds of fire resistance
            debugMessages: true,
        });
        startHeadDetection(); // Start path pushing system with configuration
        startPathPushing({
            updateIntervalTicks: 5,
            forceMultiplier: 0.5,
            targetEntityTag: "raid_target",
            debugMessages: true,
        });
        // Start phantom spawner system
        startPhantomSpawner({
            debugMode: true,
            minDaysWithoutSleep: 3,
            minYLevel: 64,
            blockedSpawnsBeforeCreeper: 3,
            checkIntervalTicks: 1200, // 1 minute
        });
    }
    system.run(mainTick);
}
system.run(mainTick);
//# sourceMappingURL=main.js.map