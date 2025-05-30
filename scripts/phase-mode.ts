// filepath: d:\Repositories\Minecraft\phantom-phase\scripts\phase-mode.ts
import { world, system, GameMode, Player, Vector3 } from "@minecraft/server";
import { enableSpeedometer, disableSpeedometer } from "./phase-mode-speedometer";
import {
  makePlayerInvulnerable,
  removePlayerInvulnerability,
  isPlayerInvulnerable,
  setInvulnerabilityDebug,
} from "./phase-mode-invulnerability";

// Configuration interface for phantom phase system
interface PhaseConfig {
  speedThresholdBps: number; // Speed threshold to enter phase mode (blocks per second)
  exitSpeedThresholdBps: number; // Speed threshold to exit phase mode (blocks per second)
  inactiveFramesThreshold: number; // Number of frames below exit speed before exiting phase mode
  ticksPerSecond: number; // Game ticks per second (for calculations)
  speedCheckInterval: number; // How often to check player speeds (in ticks)
  debugUpdateInterval: number; // How often to show debug messages (in ticks)
  debugMessages: boolean; // Whether to show debug messages
  preserveInventory: boolean; // Whether to preserve inventory during mode changes
  gameModeSwitchDelay: number; // Delay in ticks for game mode switches (improves reliability)
  strictValidation: boolean; // Whether to use strict player validation
  phaseBlockCheckDistance: number; // Distance to check for blocks ahead before entering spectator mode
  alwaysUseSpectator: boolean; // Whether to always use spectator mode regardless of blocks ahead
  spectatorBlockCheckInterval: number; // How often (in ticks) to check for blocks ahead while in spectator mode
}

// Player phase mode data type
interface PhasePlayerData {
  player: Player;
  lastPosition: Vector3;
  previousSpeed: number;
  inactiveFrames: number;
  previousGameMode?: GameMode;
  velocity?: Vector3; // Store velocity for smooth transitions out of spectator mode
}

// Map to track players in phase mode
const playersInPhaseMode = new Map<string, PhasePlayerData>();

// Default configuration constants
const DEFAULT_CONFIG: PhaseConfig = {
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
  spectatorBlockCheckInterval: 5, // Check for blocks every 5 ticks while in spectator mode
};

// Active configuration
let config: PhaseConfig = { ...DEFAULT_CONFIG };

// Store the update interval ID so we can clear it if needed
let updateIntervalId: number | undefined;
let spectatorCheckIntervalId: number | undefined;

/**
 * Gets player speed directly from the flying_speed component
 * Throws an error if the component is not available
 */
function calculatePlayerSpeed(
  player: Player,
  previousPosition: Vector3,
  intervalTicks: number = config.speedCheckInterval
): number {
  const velocity = player.getVelocity();
  return 17 * Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
}

/**
 * Switches player to spectator mode (or invulnerable mode) and adds them to phase mode tracking
 * If there's a block ahead or alwaysUseSpectator is true: enters spectator mode
 * Otherwise: keeps current game mode but makes player invulnerable
 */
function enterPhaseMode(player: Player): void {
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

    // Get current velocity for preserving movement when exiting spectator later
    const currentVelocity = player.getVelocity();

    // Add player to phase mode tracking before mode change to prevent race conditions
    playersInPhaseMode.set(player.id, {
      player,
      lastPosition: player.location,
      previousSpeed: 0,
      inactiveFrames: 0,
      previousGameMode: previousMode,
      velocity: currentVelocity, // Store current velocity for smooth transitions out
    });

    // Check if there's a block ahead or if we should always use spectator
    const shouldUseSpectator = config.alwaysUseSpectator || isBlockAheadOfPlayer(player);

    // Queue the game mode change to happen after a delay for better reliability
    system.runTimeout(() => {
      try {
        // Verify player is still valid and eligible for mode change
        if (player && player.id && !player.isValid?.()) {
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
        } else {
          // Make player invulnerable but keep their current game mode
          makePlayerInvulnerable(player);
          world.sendMessage(`§d${player.name} is phasing (staying in ${previousMode} mode with invulnerability)`);
        }
      } catch (err) {
        world.sendMessage(`§cERROR: Failed to set phase mode: ${err}`);
        // Clean up tracking data on failure
        playersInPhaseMode.delete(player.id);
      }
    }, config.gameModeSwitchDelay); // Configurable delay for stability
  } catch (e) {
    world.sendMessage(`§cERROR: Failed to set ${player.name} to phase mode: ${e}`);
  }
}

/**
 * Switches player back to their previous mode and removes them from phase tracking
 * Removes invulnerability if it was applied
 */
function exitPhaseMode(player: Player, preserveVelocity = true): void {
  try {
    // Get phase data and validate it exists
    const phaseData = playersInPhaseMode.get(player.id);
    if (!phaseData) {
      world.sendMessage(`§cWARNING: No phase data found for ${player.name} when trying to exit phase mode`);
      return;
    }

    // Use the previous game mode if available, otherwise default to survival
    const targetMode = phaseData.previousGameMode ?? GameMode.survival;

    // Store a local copy of needed data before removing tracking
    const playerName = player.name;
    const playerId = player.id;

    // Store velocity data for smooth transition
    const storedVelocity = phaseData.velocity;

    // Remove from tracking first to prevent re-entry race conditions
    playersInPhaseMode.delete(playerId);

    // Schedule the game mode change with a slight delay for better reliability
    system.runTimeout(() => {
      try {
        // Verify player is still valid before proceeding
        if (!player || !player.id || !player.isValid?.()) {
          world.sendMessage(`§cPlayer ${playerName} is no longer valid, aborting phase mode exit`);
          return;
        }

        // Check current game mode and switch if appropriate
        const currentMode = player.getGameMode();

        // Remove any invulnerability
        if (isPlayerInvulnerable(player.id)) {
          removePlayerInvulnerability(player);
        }

        if (currentMode === GameMode.spectator) {
          // Explicitly force target mode
          player.setGameMode(targetMode);

          // Apply previous velocity for smooth transition if we have stored velocity data
          if (preserveVelocity && storedVelocity) {
            // Wait a tick for game mode change to take effect
            system.runTimeout(() => {
              try {
                // Telerport player slightly forward in their view direction to avoid getting stuck
                const viewDirection = player.getViewDirection();
                const currentLocation = player.location;

                player.teleport(
                  {
                    x: currentLocation.x + viewDirection.x * 0.2,
                    y: currentLocation.y + viewDirection.y * 0.2,
                    z: currentLocation.z + viewDirection.z * 0.2,
                  },
                  { dimension: player.dimension }
                );

                // Apply velocity
                if (targetMode === GameMode.adventure || targetMode === GameMode.survival) {
                  // Apply velocity in the direction they're looking at the stored speed
                  const speed = Math.sqrt(storedVelocity.x ** 2 + storedVelocity.y ** 2 + storedVelocity.z ** 2);

                  // Normalize view direction and scale by speed
                  const normalizedView = {
                    x: viewDirection.x / Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2),
                    y: viewDirection.y / Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2),
                    z: viewDirection.z / Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2),
                  };

                  // Apply impulse in view direction
                  player.applyKnockback(normalizedView.x, normalizedView.z, speed * 0.5, 0.1);
                }
              } catch (velocityErr) {
                if (config.debugMessages) {
                  world.sendMessage(`§cError applying velocity for ${playerName}: ${velocityErr}`);
                }
              }
            }, 1);
          }

          // Update speedometer to show new state but don't disable it
          enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);

          world.sendMessage(`§a${playerName} has returned to reality! (back to ${targetMode} mode)`);
        } else if (currentMode !== targetMode) {
          // They're in an unexpected mode, switch to target mode
          world.sendMessage(`§e${playerName} is in ${currentMode} mode, restoring to ${targetMode} mode`);
          player.setGameMode(targetMode);

          // Update speedometer to show new state
          enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);
        } else {
          // They're already in the target mode, just remove invulnerability
          world.sendMessage(`§e${playerName} is no longer phasing (invulnerability removed)`);

          // Update speedometer to show new state
          enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);
        }
      } catch (err) {
        world.sendMessage(`§cERROR: Failed to restore game mode for ${playerName}: ${err}`);
      }
    }, config.gameModeSwitchDelay); // Configurable delay for stability
  } catch (e) {
    world.sendMessage(`§cERROR: Failed to restore ${player.name}'s game mode: ${e}`);
    // Still try to clean up the tracking data
    playersInPhaseMode.delete(player.id);
  }
}

/**
 * Displays debug information about a player's current speed and phase status
 */
function logPlayerDebugInfo(player: Player): void {
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

    world.sendMessage(
      `§7${player.name}: speed=${speedColor}${speed.toFixed(2)} §7b/s, isGliding=${
        player.isGliding ? "§aYes" : "§cNo"
      }, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "§aYES" : "§cNO"}`
    );
  } catch (e: any) {
    // If we can't get speed, just show that the component is not available
    world.sendMessage(
      `§7${player.name}: §cSpeed component not available, isGliding=${
        player.isGliding ? "§aYes" : "§cNo"
      }, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "§aYES" : "§cNO"}`
    );
  }
}

/**
 * Initializes tracking data for a new player
 */
function initializePlayerTracking(player: Player): PhasePlayerData {
  return {
    player,
    lastPosition: player.location,
    previousSpeed: 0,
    inactiveFrames: 0,
    previousGameMode: player.getGameMode(),
    velocity: player.getVelocity(),
  };
}

/**
 * Updates phase status for players already in phase mode
 */
function updateExistingPhasePlayer(player: Player, phaseData: PhasePlayerData): void {
  try {
    const currentSpeed = calculatePlayerSpeed(player, phaseData.lastPosition);

    phaseData.lastPosition = player.location;
    phaseData.previousSpeed = currentSpeed;

    if (currentSpeed < config.exitSpeedThresholdBps) {
      phaseData.inactiveFrames++;

      if (phaseData.inactiveFrames >= config.inactiveFramesThreshold) {
        exitPhaseMode(player);
      }
    } else {
      phaseData.inactiveFrames = 0;
    }

    // Store current velocity for smooth transitions when exiting spectator
    phaseData.velocity = player.getVelocity();
  } catch (e: any) {
    if (config.debugMessages) {
      world.sendMessage(`§c${player.name}: ${e.message}`);
    }
    // If we can't get speed, just keep current state
  }
}

/**
 * Updates and checks players not in phase mode
 */
function updateRegularPlayer(player: Player): void {
  try {
    let playerData = playersInPhaseMode.get(player.id) || initializePlayerTracking(player);

    const currentSpeed = calculatePlayerSpeed(player, playerData.lastPosition);
    playerData.lastPosition = player.location;
    playerData.previousSpeed = currentSpeed;
    playerData.velocity = player.getVelocity(); // Update stored velocity

    if (currentSpeed > config.speedThresholdBps) {
      if (config.debugMessages) {
        world.sendMessage(`§e${player.name} triggered phase mode at ${currentSpeed.toFixed(1)} b/s`);
      }
      enterPhaseMode(player);
    } else if (!playersInPhaseMode.has(player.id)) {
      playersInPhaseMode.set(player.id, playerData);
    }
  } catch (e: any) {
    if (config.debugMessages) {
      world.sendMessage(`§c${player.name}: ${e.message}`);
    }
    // If we can't get speed, don't update player state
  }
}

/**
 * Updates a single player's phase state
 */
function updatePlayerPhaseState(player: Player): void {
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
    } else {
      // Otherwise update as a regular player
      updateRegularPlayer(player);
    }
  } catch (e) {
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
function isPhaseModeCaused(player: Player): boolean {
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
function isBlockAheadOfPlayer(player: Player, maxDistance: number = config.phaseBlockCheckDistance): boolean {
  try {
    // Get the block the player is looking at with specified max distance
    const blockRaycastHit = player.getBlockFromViewDirection({ maxDistance });

    // If we found a block and it's solid, return true
    if (blockRaycastHit && blockRaycastHit.block) {
      return true;
    }

    return false;
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`§cError checking blocks ahead: ${e}`);
    }
    // Default to true on error (safer)
    return true;
  }
}

/**
 * Continuously checks for blocks ahead of players in spectator mode
 * and returns them to normal mode if no blocks are ahead
 */
function checkSpectatorPlayersForBlocks(): void {
  for (const [playerId, phaseData] of playersInPhaseMode.entries()) {
    try {
      const player = phaseData.player;

      // Only check players in spectator mode
      if (player && player.id && player.isValid?.() && player.getGameMode() === GameMode.spectator) {
        // Check if there's a block ahead
        if (!isBlockAheadOfPlayer(player)) {
          // No block ahead, switch back to normal mode but preserve velocity
          if (config.debugMessages) {
            world.sendMessage(`§a${player.name} has no blocks ahead, returning to normal mode`);
          }
          exitPhaseMode(player, true);
        }
      }
    } catch (e) {
      if (config.debugMessages) {
        world.sendMessage(`§cError checking spectator player for blocks: ${e}`);
      }
    }
  }
}

/**
 * Updates all players' phase status based on speed and conditions
 */
function updatePlayersInPhaseMode(): void {
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
    } catch (err) {
      if (config.debugMessages) {
        world.sendMessage(`§cError updating player: ${err}`);
      }
    }
  }
}

/**
 * Clean up any disconnected players from tracking
 */
function cleanupDisconnectedPlayers(): void {
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
          if (data.player.isValid?.() === false) {
            shouldRemove = true;
            reason = "reference invalid";
          }
        } catch (accessError) {
          shouldRemove = true;
          reason = "reference error";
        }
      }

      // Remove player if any check failed
      if (shouldRemove) {
        if (config.debugMessages) {
          const playerName = data.player?.name || "Unknown";
          world.sendMessage(`§7Removing player from phase tracking (${reason}): ${playerName}`);
        }
        playersInPhaseMode.delete(playerId);
      }
    } catch (e) {
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
function updateAllSpeedometers(): void {
  for (const player of world.getAllPlayers()) {
    try {
      if (player && player.id && player.isValid?.()) {
        enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, true);
      }
    } catch (e) {
      if (config.debugMessages) {
        world.sendMessage(`§cError updating speedometer for ${player.name}: ${e}`);
      }
    }
  }
}

/**
 * Update the phantom phase configuration
 */
export function updatePhaseConfig(newConfig: Partial<PhaseConfig>): void {
  config = {
    ...config,
    ...newConfig,
  };

  // Sync invulnerability debug setting
  setInvulnerabilityDebug(config.debugMessages);

  // Update speedometers for all players when config changes
  updateAllSpeedometers();
  if (config.debugMessages) {
    world.sendMessage(`§7Phase mode configuration updated:`);
    world.sendMessage(`§7Speed threshold: §f${config.speedThresholdBps.toFixed(1)} §7blocks/second`);
    world.sendMessage(`§7Exit threshold: §f${config.exitSpeedThresholdBps.toFixed(1)} §7blocks/second`);

    // Only show the block check settings if they were changed
    if (newConfig.phaseBlockCheckDistance !== undefined || newConfig.alwaysUseSpectator !== undefined) {
      world.sendMessage(`§7Block check distance: §f${config.phaseBlockCheckDistance} §7blocks`);
      world.sendMessage(
        `§7Always use spectator: §f${config.alwaysUseSpectator ? "Yes" : "No"} §7(${
          config.alwaysUseSpectator ? "Always spectator" : "Spectator only for blocks"
        })`
      );
    }
  }
}

/**
 * Initializes the phantom phase system that switches fast-moving players to spectator mode
 */
export function initializePhantomPhase(customConfig?: Partial<PhaseConfig>) {
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
    world.sendMessage(
      `§7Always use spectator: §f${config.alwaysUseSpectator ? "Yes" : "No"} §7(${
        config.alwaysUseSpectator ? "Always spectator" : "Spectator only for blocks"
      })`
    );

    // Set debug mode for the invulnerability system
    setInvulnerabilityDebug(config.debugMessages);

    // Clear any existing players in phase mode
    playersInPhaseMode.clear();

    // Initialize tracking and enable speedometer for all current players
    for (const player of world.getAllPlayers()) {
      try {
        // Enable speedometer for ALL players regardless of game mode
        if (player && player.id && player.isValid?.() !== false) {
          enableSpeedometer(player, config.speedThresholdBps, config.exitSpeedThresholdBps, false);

          // Only track non-creative/spectator players for phase mode
          if (
            !playersInPhaseMode.has(player.id) &&
            player.getGameMode() !== GameMode.creative &&
            player.getGameMode() !== GameMode.spectator
          ) {
            playersInPhaseMode.set(player.id, initializePlayerTracking(player));
          }
        }
      } catch (playerError) {
        world.sendMessage(`§cError initializing player ${player?.name || "unknown"}: ${playerError}`);
      }
    }

    // Clear any existing intervals to prevent duplicates
    try {
      if (updateIntervalId !== undefined) {
        system.clearRun(updateIntervalId);
        updateIntervalId = undefined;
      }
      if (spectatorCheckIntervalId !== undefined) {
        system.clearRun(spectatorCheckIntervalId);
        spectatorCheckIntervalId = undefined;
      }
    } catch (e) {
      // No previous interval exists or error clearing it
      world.sendMessage(`§cWarning: Could not clear previous update intervals: ${e}`);
    }

    // Set up regular update interval for phase mode system
    updateIntervalId = system.runInterval(updatePlayersInPhaseMode, config.speedCheckInterval);

    // Set up interval to check spectator players for blocks
    spectatorCheckIntervalId = system.runInterval(checkSpectatorPlayersForBlocks, config.spectatorBlockCheckInterval);

    // Set up player join handler to enable speedometer for new players
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
      } catch (e) {
        world.sendMessage(`§cError setting up new player: ${e}`);
      }
    });

    // Verify the intervals were created successfully
    if (updateIntervalId === undefined) {
      world.sendMessage(`§cWARNING: Failed to create update interval`);
    } else {
      world.sendMessage(`§aPhantom Phase system is now monitoring player speeds (interval ID: ${updateIntervalId})`);
    }

    if (spectatorCheckIntervalId === undefined) {
      world.sendMessage(`§cWARNING: Failed to create spectator check interval`);
    } else {
      world.sendMessage(`§aSpectator block checking active (interval ID: ${spectatorCheckIntervalId})`);
    }

    // Run an immediate check of all players to ensure system is working
    system.runTimeout(updatePlayersInPhaseMode, 1);

    return true;
  } catch (e) {
    world.sendMessage(`§cFailed to initialize Phantom Phase system: ${e}`);
    return false;
  }
}
