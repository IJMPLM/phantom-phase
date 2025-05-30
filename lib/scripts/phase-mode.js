import { world, system, GameMode } from "@minecraft/server";
// Map to track players in phase mode
const playersInPhaseMode = new Map();
// Default configuration constants
const DEFAULT_CONFIG = {
    speedThresholdBps: 8.0,
    exitSpeedThresholdBps: 2.0,
    inactiveFramesThreshold: 20,
    ticksPerSecond: 60,
    speedCheckInterval: 1,
    debugUpdateInterval: 10,
    debugMessages: true,
    preserveInventory: true,
};
// Active configuration
let config = Object.assign({}, DEFAULT_CONFIG);
/**
 * Gets player speed directly from the flying_speed component
 * Throws an error if the component is not available
 */
function calculatePlayerSpeed(player, previousPosition, intervalTicks = config.speedCheckInterval) {
    const velocity = player.getVelocity();
    return 17 * Math.sqrt(Math.pow(velocity.x, 2) + Math.pow(velocity.y, 2) + Math.pow(velocity.z, 2));
}
/**
 * Switches player to spectator mode and adds them to phase mode tracking
 */
function enterPhaseMode(player) {
    if (player.getGameMode() === GameMode.spectator) {
        if (config.debugMessages) {
            world.sendMessage(`§e${player.name} is already in spectator mode, not entering phase mode again.`);
        }
        return;
    }
    try {
        const previousMode = player.getGameMode();
        player.setGameMode(GameMode.spectator);
        world.sendMessage(`§b${player.name} is phasing out of reality! (from ${previousMode} mode)`);
        playersInPhaseMode.set(player.id, {
            player,
            lastPosition: player.location,
            previousSpeed: 0,
            inactiveFrames: 0,
            previousGameMode: previousMode,
        });
    }
    catch (e) {
        world.sendMessage(`§cERROR: Failed to set ${player.name} to spectator mode: ${e}`);
    }
}
/**
 * Switches player back to survival mode and removes them from phase tracking
 */
function exitPhaseMode(player) {
    var _a;
    try {
        const phaseData = playersInPhaseMode.get(player.id);
        // Use the previous game mode if available, otherwise default to survival
        const targetMode = (_a = phaseData === null || phaseData === void 0 ? void 0 : phaseData.previousGameMode) !== null && _a !== void 0 ? _a : GameMode.survival;
        player.setGameMode(targetMode);
        world.sendMessage(`§a${player.name} has returned to reality! (back to ${targetMode} mode)`);
        playersInPhaseMode.delete(player.id);
    }
    catch (e) {
        world.sendMessage(`§cERROR: Failed to restore ${player.name}'s game mode: ${e}`);
        // Still try to clean up the tracking data
        playersInPhaseMode.delete(player.id);
    }
}
/**
 * Displays debug information about a player's current speed and phase status
 */
function logPlayerDebugInfo(player) {
    if (!config.debugMessages || system.currentTick % config.debugUpdateInterval !== 0) {
        return;
    }
    const currentPos = player.location;
    const playerData = playersInPhaseMode.get(player.id);
    const isInPhaseMode = playerData && player.getGameMode() === GameMode.spectator;
    const lastPos = playerData ? playerData.lastPosition : currentPos;
    try {
        const speed = calculatePlayerSpeed(player, lastPos);
        const speedColor = speed > config.speedThresholdBps ? "§a" : speed > config.exitSpeedThresholdBps ? "§e" : "§c";
        world.sendMessage(`§7${player.name}: speed=${speedColor}${speed.toFixed(2)} §7b/s, isGliding=${player.isGliding ? "§aYes" : "§cNo"}, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "§aYES" : "§cNO"}`);
    }
    catch (e) {
        // If we can't get speed, just show that the component is not available
        world.sendMessage(`§7${player.name}: §cSpeed component not available, isGliding=${player.isGliding ? "§aYes" : "§cNo"}, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "§aYES" : "§cNO"}`);
    }
}
/**
 * Initializes tracking data for a new player
 */
function initializePlayerTracking(player) {
    return {
        player,
        lastPosition: player.location,
        previousSpeed: 0,
        inactiveFrames: 0,
        previousGameMode: player.getGameMode(),
    };
}
/**
 * Updates phase status for players already in phase mode
 */
function updateExistingPhasePlayer(player, phaseData) {
    try {
        const currentSpeed = calculatePlayerSpeed(player, phaseData.lastPosition);
        phaseData.lastPosition = player.location;
        phaseData.previousSpeed = currentSpeed;
        if (currentSpeed < config.exitSpeedThresholdBps) {
            phaseData.inactiveFrames++;
            if (phaseData.inactiveFrames >= config.inactiveFramesThreshold) {
                exitPhaseMode(player);
            }
        }
        else {
            phaseData.inactiveFrames = 0;
        }
    }
    catch (e) {
        if (config.debugMessages) {
            world.sendMessage(`§c${player.name}: ${e.message}`);
        }
        // If we can't get speed, just keep current state
    }
}
/**
 * Updates and checks players not in phase mode
 */
function updateRegularPlayer(player) {
    try {
        let playerData = playersInPhaseMode.get(player.id) || initializePlayerTracking(player);
        const currentSpeed = calculatePlayerSpeed(player, playerData.lastPosition);
        playerData.lastPosition = player.location;
        playerData.previousSpeed = currentSpeed;
        if (currentSpeed > config.speedThresholdBps) {
            if (config.debugMessages) {
                world.sendMessage(`§e${player.name} triggered phase mode at ${currentSpeed.toFixed(1)} b/s`);
            }
            enterPhaseMode(player);
        }
        else if (!playersInPhaseMode.has(player.id)) {
            playersInPhaseMode.set(player.id, playerData);
        }
    }
    catch (e) {
        if (config.debugMessages) {
            world.sendMessage(`§c${player.name}: ${e.message}`);
        }
        // If we can't get speed, don't update player state
    }
}
/**
 * Updates a single player's phase state
 */
function updatePlayerPhaseState(player) {
    if (!playersInPhaseMode.has(player.id) &&
        (player.getGameMode() === GameMode.creative || player.getGameMode() === GameMode.spectator)) {
        return; // Skip creative and spectator players not already being tracked
    }
    const phaseData = playersInPhaseMode.get(player.id);
    if (phaseData && player.getGameMode() === GameMode.spectator) {
        updateExistingPhasePlayer(player, phaseData);
    }
    else {
        updateRegularPlayer(player);
    }
}
/**
 * Updates all players' phase status based on speed and conditions
 */
function updatePlayersInPhaseMode() {
    const players = world.getAllPlayers();
    for (const player of players) {
        logPlayerDebugInfo(player);
        updatePlayerPhaseState(player);
    }
    // Clean up players who have left the game
    for (const [playerId, data] of playersInPhaseMode.entries()) {
        try {
            // This will throw if the player has left the game
            const _ = data.player.location;
        }
        catch (e) {
            playersInPhaseMode.delete(playerId);
        }
    }
}
/**
 * Update the phantom phase configuration
 */
export function updatePhaseConfig(newConfig) {
    config = Object.assign(Object.assign({}, config), newConfig);
    if (config.debugMessages) {
        world.sendMessage(`§7Phase mode configuration updated:`);
        world.sendMessage(`§7Speed threshold: §f${config.speedThresholdBps.toFixed(1)} §7blocks/second`);
        world.sendMessage(`§7Exit threshold: §f${config.exitSpeedThresholdBps.toFixed(1)} §7blocks/second`);
    }
}
/**
 * Initializes the phantom phase system that switches fast-moving players to spectator mode
 */
export function initializePhantomPhase(customConfig) {
    // Apply any custom configuration
    if (customConfig) {
        updatePhaseConfig(customConfig);
    }
    world.sendMessage("§2Phantom Phase system activated!");
    world.sendMessage(`§7Phase speed threshold: §f${config.speedThresholdBps.toFixed(1)} §7blocks/second`);
    world.sendMessage(`§7Exit speed threshold: §f${config.exitSpeedThresholdBps.toFixed(1)} §7blocks/second`);
    // Initialize tracking for all current players
    for (const player of world.getAllPlayers()) {
        if (!playersInPhaseMode.has(player.id) &&
            player.getGameMode() !== GameMode.creative &&
            player.getGameMode() !== GameMode.spectator) {
            playersInPhaseMode.set(player.id, initializePlayerTracking(player));
        }
    }
    // Set up regular update interval for phase mode system
    system.runInterval(updatePlayersInPhaseMode, config.speedCheckInterval);
}
//# sourceMappingURL=phase-mode.js.map