import { world, system } from "@minecraft/server";
import { enablePhaseMode, disablePhaseMode } from "./phase-mode";
let ticksSinceLoad = 0;
function mainTick() {
    ticksSinceLoad++;
    if (ticksSinceLoad === 60) {
        world.sendMessage("§6Phantom Phase system with speedometer2...");
        enablePhaseMode({
            speedThresholdBps: 25.0, // Enter phase mode at this speed (blocks/second)
            exitSpeedThresholdBps: 7.0, // Exit phase mode below this speed
            inactiveFramesThreshold: 20, // Wait this many frames below exit speed before leaving phase mode
            debugMessages: true, // Show debug messages
            preserveInventory: true, // Don't lose inventory during mode changes
            phaseBlockCheckDistance: 10, // Check for blocks this many blocks ahead
            alwaysUseSpectator: false, // Only use spectator when blocks are ahead
            spectatorBlockCheckInterval: 5, // Check for blocks every 5 ticks while in spectator mode
        });
    }
    if (ticksSinceLoad === 400) {
        world.sendMessage("§6Disabling Phantom Phase system...");
        disablePhaseMode();
    }
    system.run(mainTick);
}
system.run(mainTick);
//# sourceMappingURL=main.js.map