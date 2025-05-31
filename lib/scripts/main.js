import { world, system } from "@minecraft/server";
import { updatePhaseConfig, updatePhaseEndConfig } from "./phase-mode";
import { startHeadDetection } from "./phase-head-detector";
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
        startHeadDetection();
    }
    system.run(mainTick);
}
system.run(mainTick);
//# sourceMappingURL=main.js.map