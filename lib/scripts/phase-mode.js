import { world, system, GameMode } from "@minecraft/server";
import { enableSpeedometer } from "./phase-mode-speedometer";
// Map to track players in phase mode
const playersInPhaseMode = new Map();
// Default configuration constants
const DEFAULT_CONFIG = {
    speedThresholdBps: 25.0,
    exitSpeedThresholdBps: 7.0,
    inactiveFramesThreshold: 20,
    ticksPerSecond: 60,
    speedCheckInterval: 1,
    debugUpdateInterval: 10,
    gameModeSwitchDelay: 1,
    strictValidation: true,
    debugMessages: true,
    preserveInventory: true,
    phaseBlockCheckDistance: 10, // Check 10 blocks ahead by default
    alwaysUseSpectator: false, // Only use spectator when blocks are ahead
};
// Active configuration
let config = Object.assign({}, DEFAULT_CONFIG);
// Store the update interval ID so we can clear it if needed
let updateIntervalId;
/**
 * Gets player speed directly from the flying_speed component
 * Throws an error if the component is not available
 */
function calculatePlayerSpeed(player, previousPosition, intervalTicks = config.speedCheckInterval) {
    const velocity = player.getVelocity();
    return 17 * Math.sqrt(Math.pow(velocity.x, 2) + Math.pow(velocity.y, 2) + Math.pow(velocity.z, 2));
}
/**
 * Switches player to spectator mode (or invulnerable mode) and adds them to phase mode tracking
 * If there's a block ahead or alwaysUseSpectator is true: enters spectator mode
 * Otherwise: keeps current game mode but makes player invulnerable
 */
function enterPhaseMode(player) {
    // Prevent redundant mode changes if already in spectator
    if (player.getGameMode() === GameMode.spectator) {
        if (config.debugMessages) {
            world.sendMessage(`§e${player.name} is already in spectator mode, not entering phase mode again.`);
        }
        return;
    }
    try {
        // Store the previous game mode before changing it
        const previousMode = player.getGameMode();
        // Add player to phase mode tracking before mode change to prevent race conditions
        playersInPhaseMode.set(player.id, {
            player,
            lastPosition: player.location,
            previousSpeed: 0,
            inactiveFrames: 0,
            previousGameMode: previousMode,
        });
        // Check if there's a block ahead or if we should always use spectator
        const shouldUseSpectator = config.alwaysUseSpectator || isBlockAheadOfPlayer(player);
        // Queue the game mode change to happen after a delay for better reliability
        system.runTimeout(() => {
            var _a;
            try {
                // Verify player is still valid and eligible for mode change
                if (player && player.id && !((_a = player.isValid) === null || _a === void 0 ? void 0 : _a.call(player))) {
                    world.sendMessage(`§cPlayer ${player.name} is no longer valid, aborting phase mode entry`);
                    playersInPhaseMode.delete(player.id);
                    return;
                }
                if (shouldUseSpectator) {
                    // Double check that player hasn't already changed modes
                    if (player.getGameMode() !== GameMode.spectator) {
                        // Explicitly force spectator mode
                        player.setGameMode(GameMode.spectator);
                        world.sendMessage(`§b${player.name} is phasing out of reality! (from ${previousMode} mode)`);
                    }
                }
                else {
                    // Make player invulnerable but keep their current game mode
                    // Apply abilities for invulnerability
                    try {
                        player.runCommand("ability @s mayfly true");
                        player.runCommand("ability @s invulnerable true");
                        world.sendMessage(`§d${player.name} is phasing (staying in ${previousMode} mode with invulnerability)`);
                    }
                    catch (abilityError) {
                        world.sendMessage(`§cERROR: Failed to apply abilities: ${abilityError}`);
                    }
                }
            }
            catch (err) {
                world.sendMessage(`§cERROR: Failed to set phase mode: ${err}`);
                // Clean up tracking data on failure
                playersInPhaseMode.delete(player.id);
            }
        }, config.gameModeSwitchDelay); // Configurable delay for stability
    }
    catch (e) {
        world.sendMessage(`§cERROR: Failed to set ${player.name} to phase mode: ${e}`);
    }
}
/**
 * Switches player back to their previous mode and removes them from phase tracking
 * Removes invulnerability if it was applied
 */
function exitPhaseMode(player) {
    var _a;
    try {
        // Get phase data and validate it exists
        const phaseData = playersInPhaseMode.get(player.id);
        if (!phaseData) {
            world.sendMessage(`§cWARNING: No phase data found for ${player.name} when trying to exit phase mode`);
            return;
        }
        // Use the previous game mode if available, otherwise default to survival
        const targetMode = (_a = phaseData.previousGameMode) !== null && _a !== void 0 ? _a : GameMode.survival;
        // Store a local copy of needed data before removing tracking
        const playerName = player.name;
        const playerId = player.id;
        // Remove from tracking first to prevent re-entry race conditions
        playersInPhaseMode.delete(playerId);
        // Schedule the game mode change with a slight delay for better reliability
        system.runTimeout(() => {
            var _a;
            try {
                // Verify player is still valid before proceeding
                if (!player || !player.id || !((_a = player.isValid) === null || _a === void 0 ? void 0 : _a.call(player))) {
                    world.sendMessage(`§cPlayer ${playerName} is no longer valid, aborting phase mode exit`);
                    return;
                }
                // Check current game mode and switch if appropriate
                const currentMode = player.getGameMode();
                // Remove any abilities granted (invulnerability, etc.)
                try {
                    player.runCommand("ability @s mayfly false");
                    player.runCommand("ability @s invulnerable false");
                }
                catch (e) {
                    // Ignore ability errors, they're not critical
                }
                if (currentMode === GameMode.spectator) {
                    // Explicitly force target mode
                    player.setGameMode(targetMode);
                    // Update speedometer to show new state but don't disable it
                    enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);
                    world.sendMessage(`§a${playerName} has returned to reality! (back to ${targetMode} mode)`);
                }
                else if (currentMode !== targetMode) {
                    // They're in an unexpected mode, switch to target mode
                    world.sendMessage(`§e${playerName} is in ${currentMode} mode, restoring to ${targetMode} mode`);
                    player.setGameMode(targetMode);
                    // Update speedometer to show new state
                    enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);
                }
                else {
                    // They're already in the target mode, just remove abilities
                    world.sendMessage(`§e${playerName} is no longer phasing (invulnerability removed)`);
                    // Update speedometer to show new state
                    enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);
                }
            }
            catch (err) {
                world.sendMessage(`§cERROR: Failed to restore game mode for ${playerName}: ${err}`);
            }
        }, config.gameModeSwitchDelay); // Configurable delay for stability
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
    try {
        // Avoid processing creative/spectator players that aren't already tracked
        const currentGameMode = player.getGameMode();
        const isTracked = playersInPhaseMode.has(player.id);
        // Don't start tracking spectator players who aren't already tracked
        if (!isTracked && currentGameMode === GameMode.spectator && !isPhaseModeCaused(player)) {
            return;
        }
        // Get phase data if it exists
        const phaseData = playersInPhaseMode.get(player.id);
        // If player is in spectator mode and we're tracking them, they're in phase mode
        if (phaseData && currentGameMode === GameMode.spectator) {
            updateExistingPhasePlayer(player, phaseData);
        }
        else {
            // Otherwise update as a regular player
            updateRegularPlayer(player);
        }
    }
    catch (e) {
        // Handle any errors that might occur during player state update
        if (config.debugMessages) {
            world.sendMessage(`§cError updating player phase state: ${e}`);
        }
    }
}
/**
 * Checks if the player is in phase mode (spectator or invulnerable)
 * rather than manually switching to spectator
 */
function isPhaseModeCaused(player) {
    // If the player is being tracked, they're in phase mode
    const phaseData = playersInPhaseMode.get(player.id);
    return !!phaseData;
}
/**
 * Checks if there's a solid block within the specified distance in front of the player
 * @param player The player to check
 * @param maxDistance Maximum distance to check for blocks (default: 10)
 * @returns True if a solid block is found within the distance
 */
function isBlockAheadOfPlayer(player, maxDistance = config.phaseBlockCheckDistance) {
    try {
        // Get the block the player is looking at with specified max distance
        const blockRaycastHit = player.getBlockFromViewDirection({ maxDistance });
        // If we found a block and it's solid, return true
        if (blockRaycastHit && blockRaycastHit.block) {
            return true;
        }
        return false;
    }
    catch (e) {
        if (config.debugMessages) {
            world.sendMessage(`§cError checking blocks ahead: ${e}`);
        }
        // Default to true on error (safer)
        return true;
    }
}
/**
 * Updates all players' phase status based on speed and conditions
 */
function updatePlayersInPhaseMode() {
    // Clean up players who have left the game first to avoid errors
    cleanupDisconnectedPlayers();
    const players = world.getAllPlayers();
    for (const player of players) {
        // Verify player is valid before processing
        try {
            if (player && player.id) {
                logPlayerDebugInfo(player);
                updatePlayerPhaseState(player);
            }
        }
        catch (err) {
            if (config.debugMessages) {
                world.sendMessage(`§cError updating player: ${err}`);
            }
        }
    }
}
/**
 * Clean up any disconnected players from tracking
 */
function cleanupDisconnectedPlayers() {
    var _a, _b, _c;
    // Get the current set of online players for quick lookup
    const onlinePlayers = new Set(world.getAllPlayers().map((p) => p.id));
    for (const [playerId, data] of playersInPhaseMode.entries()) {
        try {
            let shouldRemove = false;
            let reason = "unknown";
            // Check if player reference is valid
            if (!data.player || !data.player.id) {
                shouldRemove = true;
                reason = "invalid reference";
            }
            // Check if player is still connected using the Set for faster lookup
            else if (!onlinePlayers.has(playerId)) {
                shouldRemove = true;
                reason = "not connected";
            }
            // Check if player reference is stale or invalid
            else {
                try {
                    // Try to access player properties - will throw if reference is invalid
                    const _ = data.player.location;
                    // Check isValid method if available
                    if (((_b = (_a = data.player).isValid) === null || _b === void 0 ? void 0 : _b.call(_a)) === false) {
                        shouldRemove = true;
                        reason = "reference invalid";
                    }
                }
                catch (accessError) {
                    shouldRemove = true;
                    reason = "reference error";
                }
            }
            // Remove player if any check failed
            if (shouldRemove) {
                if (config.debugMessages) {
                    const playerName = ((_c = data.player) === null || _c === void 0 ? void 0 : _c.name) || "Unknown";
                    world.sendMessage(`§7Removing player from phase tracking (${reason}): ${playerName}`);
                }
                playersInPhaseMode.delete(playerId);
            }
        }
        catch (e) {
            // Catch any unexpected errors and remove player from tracking to be safe
            playersInPhaseMode.delete(playerId);
            if (config.debugMessages) {
                world.sendMessage(`§cError during player cleanup: ${e}`);
            }
        }
    }
}
/**
 * Updates speedometer displays for all players
 */
function updateAllSpeedometers() {
    var _a;
    for (const player of world.getAllPlayers()) {
        try {
            if (player && player.id && ((_a = player.isValid) === null || _a === void 0 ? void 0 : _a.call(player))) {
                enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);
            }
        }
        catch (e) {
            if (config.debugMessages) {
                world.sendMessage(`§cError updating speedometer for ${player.name}: ${e}`);
            }
        }
    }
}
/**
 * Update the phantom phase configuration
 */
export function updatePhaseConfig(newConfig) {
    config = Object.assign(Object.assign({}, config), newConfig);
    // Update speedometers for all players when config changes
    updateAllSpeedometers();
    if (config.debugMessages) {
        world.sendMessage(`§7Phase mode configuration updated:`);
        world.sendMessage(`§7Speed threshold: §f${config.speedThresholdBps.toFixed(1)} §7blocks/second`);
        world.sendMessage(`§7Exit threshold: §f${config.exitSpeedThresholdBps.toFixed(1)} §7blocks/second`);
        // Only show the block check settings if they were changed
        if (newConfig.phaseBlockCheckDistance !== undefined || newConfig.alwaysUseSpectator !== undefined) {
            world.sendMessage(`§7Block check distance: §f${config.phaseBlockCheckDistance} §7blocks`);
            world.sendMessage(`§7Always use spectator: §f${config.alwaysUseSpectator ? "Yes" : "No"} §7(${config.alwaysUseSpectator ? "Always spectator" : "Spectator only for blocks"})`);
        }
    }
}
/**
 * Initializes the phantom phase system that switches fast-moving players to spectator mode
 */
export function initializePhantomPhase(customConfig) {
    var _a;
    try {
        // Apply any custom configuration
        if (customConfig) {
            updatePhaseConfig(customConfig);
        }
        world.sendMessage("§2Phantom Phase system activated!");
        world.sendMessage(`§7Phase speed threshold: §f${config.speedThresholdBps.toFixed(1)} §7blocks/second`);
        world.sendMessage(`§7Exit speed threshold: §f${config.exitSpeedThresholdBps.toFixed(1)} §7blocks/second`);
        world.sendMessage(`§7Mode change delay: §f${config.inactiveFramesThreshold} §7frames`);
        world.sendMessage(`§7Block check distance: §f${config.phaseBlockCheckDistance} §7blocks`);
        world.sendMessage(`§7Always use spectator: §f${config.alwaysUseSpectator ? "Yes" : "No"} §7(${config.alwaysUseSpectator ? "Always spectator" : "Spectator only for blocks"})`);
        // Clear any existing players in phase mode
        playersInPhaseMode.clear(); // Initialize tracking and enable speedometer for all current players
        for (const player of world.getAllPlayers()) {
            try {
                // Enable speedometer for ALL players regardless of game mode
                if (player && player.id && ((_a = player.isValid) === null || _a === void 0 ? void 0 : _a.call(player)) !== false) {
                    enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, false);
                    // Only track non-creative/spectator players for phase mode
                    if (!playersInPhaseMode.has(player.id) &&
                        player.getGameMode() !== GameMode.creative &&
                        player.getGameMode() !== GameMode.spectator) {
                        playersInPhaseMode.set(player.id, initializePlayerTracking(player));
                    }
                }
            }
            catch (playerError) {
                world.sendMessage(`§cError initializing player ${(player === null || player === void 0 ? void 0 : player.name) || "unknown"}: ${playerError}`);
            }
        }
        // Clear any existing intervals to prevent duplicates
        try {
            if (updateIntervalId !== undefined) {
                system.clearRun(updateIntervalId);
                updateIntervalId = undefined;
            }
        }
        catch (e) {
            // No previous interval exists or error clearing it
            world.sendMessage(`§cWarning: Could not clear previous update interval: ${e}`);
        } // Set up regular update interval for phase mode system
        updateIntervalId = system.runInterval(updatePlayersInPhaseMode, config.speedCheckInterval); // Set up player join handler to enable speedometer for new players
        world.afterEvents.playerJoin.subscribe((event) => {
            try {
                const playerId = event.playerId;
                const player = world.getAllPlayers().find((p) => p.id === playerId);
                if (player && player.id) {
                    // Enable speedometer for new players
                    enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, false);
                    // Track player for phase mode if appropriate
                    if (player.getGameMode() !== GameMode.creative && player.getGameMode() !== GameMode.spectator) {
                        playersInPhaseMode.set(player.id, initializePlayerTracking(player));
                    }
                }
            }
            catch (e) {
                world.sendMessage(`§cError setting up new player: ${e}`);
            }
        });
        // Verify the interval was created successfully
        if (updateIntervalId === undefined) {
            world.sendMessage(`§cWARNING: Failed to create update interval`);
        }
        else {
            world.sendMessage(`§aPhantom Phase system is now monitoring player speeds (interval ID: ${updateIntervalId})`);
        }
        // Run an immediate check of all players to ensure system is working
        system.runTimeout(updatePlayersInPhaseMode, 1);
        return true;
    }
    catch (e) {
        world.sendMessage(`§cFailed to initialize Phantom Phase system: ${e}`);
        return false;
    }
}
//# sourceMappingURL=phase-mode.js.map