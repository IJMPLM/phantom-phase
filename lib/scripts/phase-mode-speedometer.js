import { system, GameMode } from "@minecraft/server";
// Configuration for phantom phase speedometer
const config = {
    updateInterval: 2, // Update interval in ticks
    barLength: 20, // Length of the visual bar
    phaseColor: "§b", // Light blue for phase mode
    warningColor: "§e", // Yellow for approaching threshold
    dangerColor: "§c", // Red for below exit threshold
    safeColor: "§a", // Green for above entry threshold
    actionBarDuration: 10, // How long to show the action bar (ticks)
    speedThresholdBps: 25.0, // Speed threshold to enter phase mode (blocks per second)
    exitSpeedThresholdBps: 7.0, // Speed threshold to exit phase mode (blocks per second)
};
// Track players with active speedometers
const activeSpeedometers = new Map();
/**
 * Starts the phase mode speedometer for a player
 * @param player The player to enable speedometer for
 * @param speedThresholdBps Speed threshold to enter phase mode (blocks per second)
 * @param exitSpeedThresholdBps Speed threshold to exit phase mode (blocks per second)
 * @param silent Whether to suppress feedback messages
 * @returns True if successfully started
 */
export function enableSpeedometer(player, speedThresholdBps, exitSpeedThresholdBps, silent = false) {
    // Use provided thresholds or defaults from config
    const entryThreshold = speedThresholdBps !== null && speedThresholdBps !== void 0 ? speedThresholdBps : config.speedThresholdBps;
    const exitThreshold = exitSpeedThresholdBps !== null && exitSpeedThresholdBps !== void 0 ? exitSpeedThresholdBps : config.exitSpeedThresholdBps;
    // Already has active speedometer - update thresholds if different
    if (activeSpeedometers.has(player.id)) {
        const data = activeSpeedometers.get(player.id);
        // Update thresholds if they've changed
        if (data.entryThreshold !== entryThreshold || data.exitThreshold !== exitThreshold) {
            data.entryThreshold = entryThreshold;
            data.exitThreshold = exitThreshold;
            if (!silent) {
                player.sendMessage(`§bSpeedometer thresholds updated: Entry ${entryThreshold.toFixed(1)} b/s, Exit ${exitThreshold.toFixed(1)} b/s`);
            }
        }
        else if (!silent) {
            player.sendMessage("§ePhantom Phase speedometer is already active");
        }
        return true;
    }
    // Enable speedometer with continuous updates
    const updateIntervalId = system.runInterval(() => {
        updateSpeedometer(player, entryThreshold, exitThreshold);
    }, config.updateInterval);
    // Store player data with thresholds
    activeSpeedometers.set(player.id, {
        updateIntervalId,
        entryThreshold,
        exitThreshold,
    });
    if (!silent) {
        player.sendMessage("§bPhantom Phase speedometer §aactivated");
        player.sendMessage(`§7Entry threshold: §a${entryThreshold.toFixed(1)} b/s, §7Exit threshold: §e${exitThreshold.toFixed(1)} b/s`);
    }
    return true;
}
/**
 * Stops the phase mode speedometer for a player
 * @param player The player to disable speedometer for
 * @param silent Whether to suppress feedback messages
 * @returns True if successfully stopped
 */
export function disableSpeedometer(player, silent = false) {
    if (activeSpeedometers.has(player.id)) {
        const playerData = activeSpeedometers.get(player.id);
        if (playerData === null || playerData === void 0 ? void 0 : playerData.updateIntervalId) {
            system.clearRun(playerData.updateIntervalId);
        }
        activeSpeedometers.delete(player.id);
        if (!silent) {
            player.sendMessage("§bPhantom Phase speedometer §cdeactivated");
        }
        return true;
    }
    return false;
}
/**
 * Updates the visual speedometer for a player
 * @param player The player to update
 * @param entryThreshold Speed threshold to enter phase mode
 * @param exitThreshold Speed threshold to exit phase mode
 */
function updateSpeedometer(player, entryThreshold, exitThreshold) {
    var _a;
    // Safety check if player disconnected
    if (!((_a = player.isValid) === null || _a === void 0 ? void 0 : _a.call(player))) {
        if (activeSpeedometers.has(player.id)) {
            disableSpeedometer(player, true);
        }
        return;
    }
    try {
        // Calculate player speed
        const velocity = player.getVelocity();
        // The scalar 17 is used to convert velocity units to blocks per second
        const speed = 17 * Math.sqrt(Math.pow(velocity.x, 2) + Math.pow(velocity.y, 2) + Math.pow(velocity.z, 2));
        // Determine if in phase mode
        const isInPhaseMode = player.getGameMode() === GameMode.spectator;
        // Create the visual speedometer bar
        const speedometer = createSpeedometerBar(speed, entryThreshold, exitThreshold, isInPhaseMode);
        // Display the speedometer in the action bar
        player.onScreenDisplay.setActionBar(speedometer);
    }
    catch (e) {
        console.warn("Failed to update speedometer:", e);
        // Even if there's an error, try to show something
        try {
            player.onScreenDisplay.setActionBar("§cPhantom Phase speedometer error");
        }
        catch (_b) { }
    }
}
/**
 * Creates a visual speedometer bar based on current speed and thresholds
 */
function createSpeedometerBar(currentSpeed, entryThreshold, exitThreshold, isInPhaseMode) {
    // Determine the normalized position (0-1) of the speed between min and max
    const position = Math.min(1, Math.max(0, currentSpeed / entryThreshold));
    // Calculate how many bar segments to fill
    const filledSegments = Math.floor(position * config.barLength);
    // Determine color based on speed and phase status
    let barColor;
    if (isInPhaseMode) {
        barColor = currentSpeed < exitThreshold ? config.warningColor : config.phaseColor;
    }
    else {
        barColor =
            currentSpeed >= entryThreshold
                ? config.safeColor
                : currentSpeed >= exitThreshold
                    ? config.warningColor
                    : config.dangerColor;
    }
    // Create the progress bar
    let bar = "§8[";
    // Add filled segments with appropriate color
    bar += barColor + "■".repeat(filledSegments);
    // Add empty segments
    bar += "§8" + "□".repeat(config.barLength - filledSegments);
    bar += "§8]";
    // Create the full speedometer display
    const phaseStatus = isInPhaseMode ? `${config.phaseColor}PHASE` : `§7NORMAL`;
    const speedDisplay = `§f${currentSpeed.toFixed(1)} b/s`;
    // Add animated indicator if approaching thresholds
    let indicator = "";
    if (isInPhaseMode && currentSpeed < exitThreshold + 2) {
        // Blinking warning when close to exiting phase mode
        indicator = system.currentTick % 10 < 5 ? " §e⚠ EXIT SOON" : "";
    }
    else if (!isInPhaseMode && currentSpeed > entryThreshold - 5) {
        // Approaching phase entry
        indicator = " §a↑ PHASE READY";
    }
    return `§bPhantom ${phaseStatus}§r ${speedDisplay} ${bar}${indicator}`;
}
// Automatically clean up speedometers when script is reloaded
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "phantom:cleanup_speedometers") {
        for (const [playerId, playerData] of activeSpeedometers.entries()) {
            if (playerData.updateIntervalId) {
                system.clearRun(playerData.updateIntervalId);
            }
        }
        activeSpeedometers.clear();
    }
});
//# sourceMappingURL=phase-mode-speedometer.js.map