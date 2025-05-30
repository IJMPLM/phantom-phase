import { world, system } from "@minecraft/server";
import { initializePhantomPhase } from "./phase-mode";
let ticksSinceLoad = 0;
function mainTick() {
    ticksSinceLoad++;
    if (ticksSinceLoad === 60) {
        world.sendMessage("§6Phantom Phase system starting minBps: 8...");
        initialize();
    }
    system.run(mainTick);
}
function initialize() {
    // Initialize the phantom phase system with custom configuration
    initializePhantomPhase({
        speedThresholdBps: 8.0, // Enter phase mode at this speed (blocks/second)
        exitSpeedThresholdBps: 2.0, // Exit phase mode below this speed
        inactiveFramesThreshold: 20, // Wait this many frames below exit speed before leaving phase mode
        debugMessages: true, // Show debug messages
        preserveInventory: true, // Don't lose inventory during mode changes
    });
    // Example of updating configuration later if needed
    // system.runTimeout(() => {
    //   updatePhaseConfig({
    //     speedThresholdBps: 2.5,  // Lower threshold for easier activation
    //     debugMessages: false     // Turn off debug messages after initial setup
    //   });
    // }, 1200); // 1 minute later (20 ticks/second * 60 seconds)
}
system.run(mainTick);
//# sourceMappingURL=main.js.map