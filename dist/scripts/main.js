// scripts/main.ts
import { world as world4, system as system4 } from "@minecraft/server";

// scripts/phase-mode.ts
import { world as world3, system as system3, GameMode as GameMode2 } from "@minecraft/server";

// scripts/phase-mode-speedometer.ts
import { system, GameMode } from "@minecraft/server";
var config = {
  updateInterval: 2,
  // Update interval in ticks
  barLength: 20,
  // Length of the visual bar
  phaseColor: "\xA7b",
  // Light blue for phase mode
  warningColor: "\xA7e",
  // Yellow for approaching threshold
  dangerColor: "\xA7c",
  // Red for below exit threshold
  safeColor: "\xA7a",
  // Green for above entry threshold
  actionBarDuration: 10,
  // How long to show the action bar (ticks)
  speedThresholdBps: 25,
  // Speed threshold to enter phase mode (blocks per second)
  exitSpeedThresholdBps: 7
  // Speed threshold to exit phase mode (blocks per second)
};
var activeSpeedometers = /* @__PURE__ */ new Map();
function enableSpeedometer(player, speedThresholdBps, exitSpeedThresholdBps, silent = false) {
  const entryThreshold = speedThresholdBps ?? config.speedThresholdBps;
  const exitThreshold = exitSpeedThresholdBps ?? config.exitSpeedThresholdBps;
  if (activeSpeedometers.has(player.id)) {
    const data = activeSpeedometers.get(player.id);
    if (data.entryThreshold !== entryThreshold || data.exitThreshold !== exitThreshold) {
      data.entryThreshold = entryThreshold;
      data.exitThreshold = exitThreshold;
      if (!silent) {
        player.sendMessage(
          `\xA7bSpeedometer thresholds updated: Entry ${entryThreshold.toFixed(1)} b/s, Exit ${exitThreshold.toFixed(
            1
          )} b/s`
        );
      }
    } else if (!silent) {
      player.sendMessage("\xA7ePhantom Phase speedometer is already active");
    }
    return true;
  }
  const updateIntervalId2 = system.runInterval(() => {
    updateSpeedometer(player, entryThreshold, exitThreshold);
  }, config.updateInterval);
  activeSpeedometers.set(player.id, {
    updateIntervalId: updateIntervalId2,
    entryThreshold,
    exitThreshold
  });
  if (!silent) {
    player.sendMessage("\xA7bPhantom Phase speedometer \xA7aactivated");
    player.sendMessage(
      `\xA77Entry threshold: \xA7a${entryThreshold.toFixed(1)} b/s, \xA77Exit threshold: \xA7e${exitThreshold.toFixed(1)} b/s`
    );
  }
  return true;
}
function disableSpeedometer(player, silent = false) {
  if (activeSpeedometers.has(player.id)) {
    const playerData = activeSpeedometers.get(player.id);
    if (playerData?.updateIntervalId) {
      system.clearRun(playerData.updateIntervalId);
    }
    activeSpeedometers.delete(player.id);
    if (!silent) {
      player.sendMessage("\xA7bPhantom Phase speedometer \xA7cdeactivated");
    }
    return true;
  }
  return false;
}
function updateSpeedometer(player, entryThreshold, exitThreshold) {
  if (!player.isValid?.()) {
    if (activeSpeedometers.has(player.id)) {
      disableSpeedometer(player, true);
    }
    return;
  }
  try {
    const velocity = player.getVelocity();
    const speed = 17 * Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    const isInPhaseMode = player.getGameMode() === GameMode.spectator;
    const speedometer = createSpeedometerBar(speed, entryThreshold, exitThreshold, isInPhaseMode);
    player.onScreenDisplay.setActionBar(speedometer);
  } catch (e) {
    console.warn("Failed to update speedometer:", e);
    try {
      player.onScreenDisplay.setActionBar("\xA7cPhantom Phase speedometer error");
    } catch {
    }
  }
}
function createSpeedometerBar(currentSpeed, entryThreshold, exitThreshold, isInPhaseMode) {
  const position = Math.min(1, Math.max(0, currentSpeed / entryThreshold));
  const filledSegments = Math.floor(position * config.barLength);
  let barColor;
  if (isInPhaseMode) {
    barColor = currentSpeed < exitThreshold ? config.warningColor : config.phaseColor;
  } else {
    barColor = currentSpeed >= entryThreshold ? config.safeColor : currentSpeed >= exitThreshold ? config.warningColor : config.dangerColor;
  }
  let bar = "\xA78[";
  bar += barColor + "\u25A0".repeat(filledSegments);
  bar += "\xA78" + "\u25A1".repeat(config.barLength - filledSegments);
  bar += "\xA78]";
  const phaseStatus = isInPhaseMode ? `${config.phaseColor}PHASE` : `\xA77NORMAL`;
  const speedDisplay = `\xA7f${currentSpeed.toFixed(1)} b/s`;
  let indicator = "";
  if (isInPhaseMode && currentSpeed < exitThreshold + 2) {
    indicator = system.currentTick % 10 < 5 ? " \xA7e\u26A0 EXIT SOON" : "";
  } else if (!isInPhaseMode && currentSpeed > entryThreshold - 5) {
    indicator = " \xA7a\u2191 PHASE READY";
  }
  return `\xA7bPhantom ${phaseStatus}\xA7r ${speedDisplay} ${bar}${indicator}`;
}
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

// scripts/phase-mode-invulnerability.ts
import { world as world2, system as system2 } from "@minecraft/server";
var invulnerablePlayers = /* @__PURE__ */ new Set();
var debugMessages = true;
function makePlayerInvulnerable(player) {
  try {
    invulnerablePlayers.add(player.id);
    player.runCommand("ability @s mayfly true");
    player.runCommand("ability @s invulnerable true");
    player.runCommand("effect @s fire_resistance 1 1 true");
    if (debugMessages) {
      console.warn(`[PhaseInvulnerability] Player ${player.name} is now invulnerable`);
    }
  } catch (e) {
    if (debugMessages) {
      world2.sendMessage(`\xA7cFailed to make ${player.name} invulnerable: ${e}`);
    }
  }
}
function removePlayerInvulnerability(player) {
  try {
    invulnerablePlayers.delete(player.id);
    player.runCommand("ability @s mayfly false");
    player.runCommand("ability @s invulnerable false");
    if (debugMessages) {
      console.warn(`[PhaseInvulnerability] Player ${player.name} is no longer invulnerable`);
    }
  } catch (e) {
    if (debugMessages) {
      world2.sendMessage(`\xA7cFailed to remove invulnerability from ${player.name}: ${e}`);
    }
  }
}
function isPlayerInvulnerable(playerId) {
  return invulnerablePlayers.has(playerId);
}
function setInvulnerabilityDebug(enabled) {
  debugMessages = enabled;
}
function clearInvulnerabilityData() {
  invulnerablePlayers.clear();
}
function initializeDamageHandler() {
  system2.runInterval(() => {
    for (const playerId of invulnerablePlayers) {
      try {
        const player = world2.getAllPlayers().find((p) => p.id === playerId);
        if (!player) continue;
        player.runCommand("ability @s invulnerable true");
        if (player.hasTag("on_fire") || player.dimension.getBlock(player.location)?.typeId?.includes("lava")) {
          player.runCommand("effect @s fire_resistance 2 1 true");
          player.runCommand("execute as @s run tag @s remove on_fire");
        }
        if (player.dimension.getBlock(player.location)?.typeId?.includes("water")) {
          player.runCommand("effect @s water_breathing 2 1 true");
        }
      } catch (e) {
        if (debugMessages) {
          console.error(`[PhaseInvulnerability] Error in protection handler: ${e}`);
        }
      }
    }
  }, 5);
  const tickIntervalId = system2.runInterval(() => {
    for (const playerId of invulnerablePlayers) {
      try {
        const player = world2.getAllPlayers().find((p) => p.id === playerId);
        if (player) {
          if (system2.currentTick % 100 === 0) {
            player.runCommand("ability @s invulnerable true");
          }
          if (player.location.y < -60) {
            player.teleport(
              {
                x: player.location.x,
                y: 0,
                z: player.location.z
              },
              { dimension: player.dimension }
            );
            if (debugMessages) {
              console.warn(`[PhaseInvulnerability] Saved ${player.name} from void death`);
            }
          }
        }
      } catch (e) {
        if (debugMessages) {
          console.error(`[PhaseInvulnerability] Error in tick handler for player: ${e}`);
        }
      }
    }
  }, 20);
  system2.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "phantom:cleanup_invulnerability") {
      system2.clearRun(tickIntervalId);
      clearInvulnerabilityData();
    }
  });
}
initializeDamageHandler();

// scripts/phase-mode.ts
var playersInPhaseMode = /* @__PURE__ */ new Map();
var DEFAULT_CONFIG = {
  speedThresholdBps: 25,
  exitSpeedThresholdBps: 7,
  inactiveFramesThreshold: 20,
  ticksPerSecond: 60,
  speedCheckInterval: 1,
  debugUpdateInterval: 10,
  gameModeSwitchDelay: 1,
  strictValidation: true,
  debugMessages: true,
  preserveInventory: true,
  phaseBlockCheckDistance: 10,
  // Check 10 blocks ahead by default
  alwaysUseSpectator: false,
  // Only use spectator when blocks are ahead
  spectatorBlockCheckInterval: 5
  // Check for blocks every 5 ticks while in spectator mode
};
var config2 = { ...DEFAULT_CONFIG };
var updateIntervalId;
var spectatorCheckIntervalId;
function calculatePlayerSpeed(player, previousPosition, intervalTicks = config2.speedCheckInterval) {
  const velocity = player.getVelocity();
  return 17 * Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
}
function enterPhaseMode(player) {
  if (player.getGameMode() === GameMode2.spectator) {
    if (config2.debugMessages) {
      world3.sendMessage(`\xA7e${player.name} is already in spectator mode, not entering phase mode again.`);
    }
    return;
  }
  try {
    const previousMode = player.getGameMode();
    const currentVelocity = player.getVelocity();
    playersInPhaseMode.set(player.id, {
      player,
      lastPosition: player.location,
      previousSpeed: 0,
      inactiveFrames: 0,
      previousGameMode: previousMode,
      velocity: currentVelocity
      // Store current velocity for smooth transitions out
    });
    const shouldUseSpectator = config2.alwaysUseSpectator || isBlockAheadOfPlayer(player);
    system3.runTimeout(() => {
      try {
        if (player && player.id && !player.isValid?.()) {
          world3.sendMessage(`\xA7cPlayer ${player.name} is no longer valid, aborting phase mode entry`);
          playersInPhaseMode.delete(player.id);
          return;
        }
        if (shouldUseSpectator) {
          if (player.getGameMode() !== GameMode2.spectator) {
            player.setGameMode(GameMode2.spectator);
            world3.sendMessage(`\xA7b${player.name} is phasing out of reality! (from ${previousMode} mode)`);
          }
        } else {
          makePlayerInvulnerable(player);
          world3.sendMessage(`\xA7d${player.name} is phasing (staying in ${previousMode} mode with invulnerability)`);
        }
      } catch (err) {
        world3.sendMessage(`\xA7cERROR: Failed to set phase mode: ${err}`);
        playersInPhaseMode.delete(player.id);
      }
    }, config2.gameModeSwitchDelay);
  } catch (e) {
    world3.sendMessage(`\xA7cERROR: Failed to set ${player.name} to phase mode: ${e}`);
  }
}
function exitPhaseMode(player, preserveVelocity = true) {
  try {
    const phaseData = playersInPhaseMode.get(player.id);
    if (!phaseData) {
      world3.sendMessage(`\xA7cWARNING: No phase data found for ${player.name} when trying to exit phase mode`);
      return;
    }
    const targetMode = phaseData.previousGameMode ?? GameMode2.survival;
    const playerName = player.name;
    const playerId = player.id;
    const storedVelocity = phaseData.velocity;
    playersInPhaseMode.delete(playerId);
    system3.runTimeout(() => {
      try {
        if (!player || !player.id || !player.isValid?.()) {
          world3.sendMessage(`\xA7cPlayer ${playerName} is no longer valid, aborting phase mode exit`);
          return;
        }
        const currentMode = player.getGameMode();
        if (isPlayerInvulnerable(player.id)) {
          removePlayerInvulnerability(player);
        }
        if (currentMode === GameMode2.spectator) {
          player.setGameMode(targetMode);
          if (preserveVelocity && storedVelocity) {
            system3.runTimeout(() => {
              try {
                const viewDirection = player.getViewDirection();
                const currentLocation = player.location;
                player.teleport(
                  {
                    x: currentLocation.x + viewDirection.x * 0.2,
                    y: currentLocation.y + viewDirection.y * 0.2,
                    z: currentLocation.z + viewDirection.z * 0.2
                  },
                  { dimension: player.dimension }
                );
                if (targetMode === GameMode2.adventure || targetMode === GameMode2.survival) {
                  const speed = Math.sqrt(storedVelocity.x ** 2 + storedVelocity.y ** 2 + storedVelocity.z ** 2);
                  const normalizedView = {
                    x: viewDirection.x / Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2),
                    y: viewDirection.y / Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2),
                    z: viewDirection.z / Math.sqrt(viewDirection.x ** 2 + viewDirection.y ** 2 + viewDirection.z ** 2)
                  };
                  player.applyKnockback(normalizedView.x, normalizedView.z, speed * 0.5, 0.1);
                }
              } catch (velocityErr) {
                if (config2.debugMessages) {
                  world3.sendMessage(`\xA7cError applying velocity for ${playerName}: ${velocityErr}`);
                }
              }
            }, 1);
          }
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, true);
          world3.sendMessage(`\xA7a${playerName} has returned to reality! (back to ${targetMode} mode)`);
        } else if (currentMode !== targetMode) {
          world3.sendMessage(`\xA7e${playerName} is in ${currentMode} mode, restoring to ${targetMode} mode`);
          player.setGameMode(targetMode);
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, true);
        } else {
          world3.sendMessage(`\xA7e${playerName} is no longer phasing (invulnerability removed)`);
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, true);
        }
      } catch (err) {
        world3.sendMessage(`\xA7cERROR: Failed to restore game mode for ${playerName}: ${err}`);
      }
    }, config2.gameModeSwitchDelay);
  } catch (e) {
    world3.sendMessage(`\xA7cERROR: Failed to restore ${player.name}'s game mode: ${e}`);
    playersInPhaseMode.delete(player.id);
  }
}
function logPlayerDebugInfo(player) {
  if (!config2.debugMessages || system3.currentTick % config2.debugUpdateInterval !== 0) {
    return;
  }
  const currentPos = player.location;
  const playerData = playersInPhaseMode.get(player.id);
  const isInPhaseMode = playerData && player.getGameMode() === GameMode2.spectator;
  const lastPos = playerData ? playerData.lastPosition : currentPos;
  try {
    const speed = calculatePlayerSpeed(player, lastPos);
    const speedColor = speed > config2.speedThresholdBps ? "\xA7a" : speed > config2.exitSpeedThresholdBps ? "\xA7e" : "\xA7c";
    world3.sendMessage(
      `\xA77${player.name}: speed=${speedColor}${speed.toFixed(2)} \xA77b/s, isGliding=${player.isGliding ? "\xA7aYes" : "\xA7cNo"}, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "\xA7aYES" : "\xA7cNO"}`
    );
  } catch (e) {
    world3.sendMessage(
      `\xA77${player.name}: \xA7cSpeed component not available, isGliding=${player.isGliding ? "\xA7aYes" : "\xA7cNo"}, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "\xA7aYES" : "\xA7cNO"}`
    );
  }
}
function initializePlayerTracking(player) {
  return {
    player,
    lastPosition: player.location,
    previousSpeed: 0,
    inactiveFrames: 0,
    previousGameMode: player.getGameMode(),
    velocity: player.getVelocity()
  };
}
function updateExistingPhasePlayer(player, phaseData) {
  try {
    const currentSpeed = calculatePlayerSpeed(player, phaseData.lastPosition);
    phaseData.lastPosition = player.location;
    phaseData.previousSpeed = currentSpeed;
    if (currentSpeed < config2.exitSpeedThresholdBps) {
      phaseData.inactiveFrames++;
      if (phaseData.inactiveFrames >= config2.inactiveFramesThreshold) {
        exitPhaseMode(player);
      }
    } else {
      phaseData.inactiveFrames = 0;
    }
    phaseData.velocity = player.getVelocity();
  } catch (e) {
    if (config2.debugMessages) {
      world3.sendMessage(`\xA7c${player.name}: ${e.message}`);
    }
  }
}
function updateRegularPlayer(player) {
  try {
    let playerData = playersInPhaseMode.get(player.id) || initializePlayerTracking(player);
    const currentSpeed = calculatePlayerSpeed(player, playerData.lastPosition);
    playerData.lastPosition = player.location;
    playerData.previousSpeed = currentSpeed;
    playerData.velocity = player.getVelocity();
    if (currentSpeed > config2.speedThresholdBps) {
      if (config2.debugMessages) {
        world3.sendMessage(`\xA7e${player.name} triggered phase mode at ${currentSpeed.toFixed(1)} b/s`);
      }
      enterPhaseMode(player);
    } else if (!playersInPhaseMode.has(player.id)) {
      playersInPhaseMode.set(player.id, playerData);
    }
  } catch (e) {
    if (config2.debugMessages) {
      world3.sendMessage(`\xA7c${player.name}: ${e.message}`);
    }
  }
}
function updatePlayerPhaseState(player) {
  try {
    const currentGameMode = player.getGameMode();
    const isTracked = playersInPhaseMode.has(player.id);
    if (!isTracked && currentGameMode === GameMode2.spectator && !isPhaseModeCaused(player)) {
      return;
    }
    const phaseData = playersInPhaseMode.get(player.id);
    if (phaseData && currentGameMode === GameMode2.spectator) {
      updateExistingPhasePlayer(player, phaseData);
    } else {
      updateRegularPlayer(player);
    }
  } catch (e) {
    if (config2.debugMessages) {
      world3.sendMessage(`\xA7cError updating player phase state: ${e}`);
    }
  }
}
function isPhaseModeCaused(player) {
  const phaseData = playersInPhaseMode.get(player.id);
  return !!phaseData;
}
function isBlockAheadOfPlayer(player, maxDistance = config2.phaseBlockCheckDistance) {
  try {
    const blockRaycastHit = player.getBlockFromViewDirection({ maxDistance });
    if (blockRaycastHit && blockRaycastHit.block) {
      return true;
    }
    return false;
  } catch (e) {
    if (config2.debugMessages) {
      world3.sendMessage(`\xA7cError checking blocks ahead: ${e}`);
    }
    return true;
  }
}
function checkSpectatorPlayersForBlocks() {
  for (const [playerId, phaseData] of playersInPhaseMode.entries()) {
    try {
      const player = phaseData.player;
      if (player && player.id && player.isValid?.() && player.getGameMode() === GameMode2.spectator) {
        if (!isBlockAheadOfPlayer(player)) {
          if (config2.debugMessages) {
            world3.sendMessage(`\xA7a${player.name} has no blocks ahead, returning to normal mode`);
          }
          exitPhaseMode(player, true);
        }
      }
    } catch (e) {
      if (config2.debugMessages) {
        world3.sendMessage(`\xA7cError checking spectator player for blocks: ${e}`);
      }
    }
  }
}
function updatePlayersInPhaseMode() {
  cleanupDisconnectedPlayers();
  const players = world3.getAllPlayers();
  for (const player of players) {
    try {
      if (player && player.id) {
        logPlayerDebugInfo(player);
        updatePlayerPhaseState(player);
      }
    } catch (err) {
      if (config2.debugMessages) {
        world3.sendMessage(`\xA7cError updating player: ${err}`);
      }
    }
  }
}
function cleanupDisconnectedPlayers() {
  const onlinePlayers = new Set(world3.getAllPlayers().map((p) => p.id));
  for (const [playerId, data] of playersInPhaseMode.entries()) {
    try {
      let shouldRemove = false;
      let reason = "unknown";
      if (!data.player || !data.player.id) {
        shouldRemove = true;
        reason = "invalid reference";
      } else if (!onlinePlayers.has(playerId)) {
        shouldRemove = true;
        reason = "not connected";
      } else {
        try {
          const _ = data.player.location;
          if (data.player.isValid?.() === false) {
            shouldRemove = true;
            reason = "reference invalid";
          }
        } catch (accessError) {
          shouldRemove = true;
          reason = "reference error";
        }
      }
      if (shouldRemove) {
        if (config2.debugMessages) {
          const playerName = data.player?.name || "Unknown";
          world3.sendMessage(`\xA77Removing player from phase tracking (${reason}): ${playerName}`);
        }
        playersInPhaseMode.delete(playerId);
      }
    } catch (e) {
      playersInPhaseMode.delete(playerId);
      if (config2.debugMessages) {
        world3.sendMessage(`\xA7cError during player cleanup: ${e}`);
      }
    }
  }
}
function updateAllSpeedometers() {
  for (const player of world3.getAllPlayers()) {
    try {
      if (player && player.id && player.isValid?.()) {
        enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, true);
      }
    } catch (e) {
      if (config2.debugMessages) {
        world3.sendMessage(`\xA7cError updating speedometer for ${player.name}: ${e}`);
      }
    }
  }
}
function updatePhaseConfig(newConfig) {
  config2 = {
    ...config2,
    ...newConfig
  };
  setInvulnerabilityDebug(config2.debugMessages);
  updateAllSpeedometers();
  if (config2.debugMessages) {
    world3.sendMessage(`\xA77Phase mode configuration updated:`);
    world3.sendMessage(`\xA77Speed threshold: \xA7f${config2.speedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world3.sendMessage(`\xA77Exit threshold: \xA7f${config2.exitSpeedThresholdBps.toFixed(1)} \xA77blocks/second`);
    if (newConfig.phaseBlockCheckDistance !== void 0 || newConfig.alwaysUseSpectator !== void 0) {
      world3.sendMessage(`\xA77Block check distance: \xA7f${config2.phaseBlockCheckDistance} \xA77blocks`);
      world3.sendMessage(
        `\xA77Always use spectator: \xA7f${config2.alwaysUseSpectator ? "Yes" : "No"} \xA77(${config2.alwaysUseSpectator ? "Always spectator" : "Spectator only for blocks"})`
      );
    }
  }
}
function initializePhaseMode(customConfig) {
  try {
    if (customConfig) {
      updatePhaseConfig(customConfig);
    }
    world3.sendMessage("\xA72Phantom Phase system activated!");
    world3.sendMessage(`\xA77Phase speed threshold: \xA7f${config2.speedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world3.sendMessage(`\xA77Exit speed threshold: \xA7f${config2.exitSpeedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world3.sendMessage(`\xA77Mode change delay: \xA7f${config2.inactiveFramesThreshold} \xA77frames`);
    world3.sendMessage(`\xA77Block check distance: \xA7f${config2.phaseBlockCheckDistance} \xA77blocks`);
    world3.sendMessage(
      `\xA77Always use spectator: \xA7f${config2.alwaysUseSpectator ? "Yes" : "No"} \xA77(${config2.alwaysUseSpectator ? "Always spectator" : "Spectator only for blocks"})`
    );
    setInvulnerabilityDebug(config2.debugMessages);
    playersInPhaseMode.clear();
    for (const player of world3.getAllPlayers()) {
      try {
        if (player && player.id && player.isValid?.() !== false) {
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, false);
          if (!playersInPhaseMode.has(player.id) && player.getGameMode() !== GameMode2.creative && player.getGameMode() !== GameMode2.spectator) {
            playersInPhaseMode.set(player.id, initializePlayerTracking(player));
          }
        }
      } catch (playerError) {
        world3.sendMessage(`\xA7cError initializing player ${player?.name || "unknown"}: ${playerError}`);
      }
    }
    try {
      if (updateIntervalId !== void 0) {
        system3.clearRun(updateIntervalId);
        updateIntervalId = void 0;
      }
      if (spectatorCheckIntervalId !== void 0) {
        system3.clearRun(spectatorCheckIntervalId);
        spectatorCheckIntervalId = void 0;
      }
    } catch (e) {
      world3.sendMessage(`\xA7cWarning: Could not clear previous update intervals: ${e}`);
    }
    updateIntervalId = system3.runInterval(updatePlayersInPhaseMode, config2.speedCheckInterval);
    spectatorCheckIntervalId = system3.runInterval(checkSpectatorPlayersForBlocks, config2.spectatorBlockCheckInterval);
    world3.afterEvents.playerJoin.subscribe((event) => {
      try {
        const playerId = event.playerId;
        const player = world3.getAllPlayers().find((p) => p.id === playerId);
        if (player && player.id) {
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, false);
          if (player.getGameMode() !== GameMode2.creative && player.getGameMode() !== GameMode2.spectator) {
            playersInPhaseMode.set(player.id, initializePlayerTracking(player));
          }
        }
      } catch (e) {
        world3.sendMessage(`\xA7cError setting up new player: ${e}`);
      }
    });
    if (updateIntervalId === void 0) {
      world3.sendMessage(`\xA7cWARNING: Failed to create update interval`);
    } else {
      world3.sendMessage(`\xA7aPhantom Phase system is now monitoring player speeds (interval ID: ${updateIntervalId})`);
    }
    if (spectatorCheckIntervalId === void 0) {
      world3.sendMessage(`\xA7cWARNING: Failed to create spectator check interval`);
    } else {
      world3.sendMessage(`\xA7aSpectator block checking active (interval ID: ${spectatorCheckIntervalId})`);
    }
    system3.runTimeout(updatePlayersInPhaseMode, 1);
    return true;
  } catch (e) {
    world3.sendMessage(`\xA7cFailed to initialize Phantom Phase system: ${e}`);
    return false;
  }
}
function enablePhaseMode(customConfig) {
  if (updateIntervalId !== void 0 || spectatorCheckIntervalId !== void 0) {
    disablePhaseMode();
  }
  return initializePhaseMode(customConfig);
}
function disablePhaseMode() {
  try {
    if (updateIntervalId !== void 0) {
      system3.clearRun(updateIntervalId);
      updateIntervalId = void 0;
    }
    if (spectatorCheckIntervalId !== void 0) {
      system3.clearRun(spectatorCheckIntervalId);
      spectatorCheckIntervalId = void 0;
    }
    for (const [playerId, phaseData] of playersInPhaseMode.entries()) {
      try {
        const player = phaseData.player;
        if (player && player.id && player.isValid?.()) {
          exitPhaseMode(player, false);
          disableSpeedometer(player);
        }
      } catch (e) {
        world3.sendMessage(`\xA7cError exiting phase mode for player: ${e}`);
      }
    }
    for (const player of world3.getAllPlayers()) {
      try {
        if (player && player.id && player.isValid?.()) {
          disableSpeedometer(player);
        }
      } catch (e) {
      }
    }
    playersInPhaseMode.clear();
    world3.sendMessage("\xA7cPhantom Phase system disabled");
  } catch (e) {
    world3.sendMessage(`\xA7cError disabling Phantom Phase system: ${e}`);
  }
}

// scripts/main.ts
var ticksSinceLoad = 0;
function mainTick() {
  ticksSinceLoad++;
  if (ticksSinceLoad === 60) {
    world4.sendMessage("\xA76Phantom Phase system with speedometer2...");
    enablePhaseMode({
      speedThresholdBps: 25,
      // Enter phase mode at this speed (blocks/second)
      exitSpeedThresholdBps: 7,
      // Exit phase mode below this speed
      inactiveFramesThreshold: 20,
      // Wait this many frames below exit speed before leaving phase mode
      debugMessages: true,
      // Show debug messages
      preserveInventory: true,
      // Don't lose inventory during mode changes
      phaseBlockCheckDistance: 10,
      // Check for blocks this many blocks ahead
      alwaysUseSpectator: false,
      // Only use spectator when blocks are ahead
      spectatorBlockCheckInterval: 5
      // Check for blocks every 5 ticks while in spectator mode
    });
  }
  if (ticksSinceLoad === 400) {
    world4.sendMessage("\xA76Disabling Phantom Phase system...");
    disablePhaseMode();
  }
  system4.run(mainTick);
}
system4.run(mainTick);

//# sourceMappingURL=../debug/main.js.map
