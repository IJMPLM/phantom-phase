import { world, system, EquipmentSlot } from "@minecraft/server";
import { enablePhaseMode, disablePhaseMode, updatePhaseConfig } from "./phase-mode";
let ticksSinceLoad = 0;
let phantomPhaseActive = false;
let helmetCheckInterval;
const PHASE_HEAD = {
    id: "phantom-phase:phase_head", // The special helmet that activates phase mode
    checkInterval: 20, // Check helmets every 20 ticks (1 second)
};
function mainTick() {
    ticksSinceLoad++;
    if (ticksSinceLoad === 60) {
        world.sendMessage("§6Phantom Phase system initialized...");
        // Set up configuration but don't enable it yet
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
        // Start checking for helmets
        startHeadDetection();
    }
    system.run(mainTick);
}
system.run(mainTick);
function startHeadDetection() {
    if (helmetCheckInterval !== undefined) {
        system.clearRun(helmetCheckInterval);
    }
    helmetCheckInterval = system.runInterval(() => {
        checkAllPlayersHeads();
    }, PHASE_HEAD.checkInterval);
    world.sendMessage("§6Head detection activated - wear a o activate phantom phase!");
}
function checkAllPlayersHeads() {
    let anyPlayerWearingHead = false;
    for (const player of world.getAllPlayers()) {
        try {
            if (isPlayerWearingPhaseHead(player)) {
                anyPlayerWearingHead = true;
                break;
            }
        }
        catch (e) {
            console.warn(`Error checking helmet for player ${player.name}: ${e}`);
        }
    }
    // Toggle phase mode based on whether anyone is wearing the helmet
    if (anyPlayerWearingHead && !phantomPhaseActive) {
        enablePhaseMode();
        phantomPhaseActive = true;
        world.sendMessage("§aPhantom Phase activated - special helmet detected!");
    }
    else if (!anyPlayerWearingHead && phantomPhaseActive) {
        disablePhaseMode();
        phantomPhaseActive = false;
        world.sendMessage("§cPhantom Phase deactivated - no special helmets detected");
    }
}
/**
 * Checks if a player is wearing the special phase helmet
 */
function isPlayerWearingPhaseHead(player) {
    var _a;
    try {
        const helmet = (_a = player.getComponent("minecraft:equippable")) === null || _a === void 0 ? void 0 : _a.getEquipment(EquipmentSlot.Head);
        if (helmet && helmet.typeId === PHASE_HEAD.id) {
            // You can add additional checks here (e.g., specific enchantments, custom names)
            return true;
        }
    }
    catch (e) {
        console.warn(`Error checking helmet: ${e}`);
    }
    return false;
}
//# sourceMappingURL=main.js.map