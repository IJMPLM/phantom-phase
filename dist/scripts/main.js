// scripts/main.ts
import { world as world3, system as system3 } from "@minecraft/server";

// scripts/phase-mode.ts
import { world as world2, system as system2, GameMode as GameMode2 } from "@minecraft/server";

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
  preserveInventory: true
};
var config2 = { ...DEFAULT_CONFIG };
var updateIntervalId;
function calculatePlayerSpeed(player, previousPosition, intervalTicks = config2.speedCheckInterval) {
  const velocity = player.getVelocity();
  return 17 * Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
}
function enterPhaseMode(player) {
  if (player.getGameMode() === GameMode2.spectator) {
    if (config2.debugMessages) {
      world2.sendMessage(`\xA7e${player.name} is already in spectator mode, not entering phase mode again.`);
    }
    return;
  }
  try {
    const previousMode = player.getGameMode();
    playersInPhaseMode.set(player.id, {
      player,
      lastPosition: player.location,
      previousSpeed: 0,
      inactiveFrames: 0,
      previousGameMode: previousMode
    });
    system2.runTimeout(() => {
      try {
        if (player && player.id && !player.isValid?.()) {
          world2.sendMessage(`\xA7cPlayer ${player.name} is no longer valid, aborting phase mode entry`);
          playersInPhaseMode.delete(player.id);
          return;
        }
        if (player.getGameMode() !== GameMode2.spectator) {
          player.setGameMode(GameMode2.spectator);
          world2.sendMessage(`\xA7b${player.name} is phasing out of reality! (from ${previousMode} mode)`);
        }
      } catch (err) {
        world2.sendMessage(`\xA7cERROR: Failed to set spectator mode: ${err}`);
      }
    }, config2.gameModeSwitchDelay);
  } catch (e) {
    world2.sendMessage(`\xA7cERROR: Failed to set ${player.name} to spectator mode: ${e}`);
  }
}
function exitPhaseMode(player) {
  try {
    const phaseData = playersInPhaseMode.get(player.id);
    if (!phaseData) {
      world2.sendMessage(`\xA7cWARNING: No phase data found for ${player.name} when trying to exit phase mode`);
      return;
    }
    const targetMode = phaseData.previousGameMode ?? GameMode2.survival;
    const playerName = player.name;
    const playerId = player.id;
    playersInPhaseMode.delete(playerId);
    system2.runTimeout(() => {
      try {
        if (!player || !player.id || !player.isValid?.()) {
          world2.sendMessage(`\xA7cPlayer ${playerName} is no longer valid, aborting phase mode exit`);
          return;
        }
        const currentMode = player.getGameMode();
        if (currentMode === GameMode2.spectator) {
          player.setGameMode(targetMode);
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, true);
          world2.sendMessage(`\xA7a${playerName} has returned to reality! (back to ${targetMode} mode)`);
        } else if (currentMode !== targetMode) {
          world2.sendMessage(`\xA7e${playerName} is in ${currentMode} mode, restoring to ${targetMode} mode`);
          player.setGameMode(targetMode);
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, true);
        } else {
          world2.sendMessage(`\xA7e${playerName} is already in ${targetMode} mode`);
        }
      } catch (err) {
        world2.sendMessage(`\xA7cERROR: Failed to restore game mode for ${playerName}: ${err}`);
      }
    }, config2.gameModeSwitchDelay);
  } catch (e) {
    world2.sendMessage(`\xA7cERROR: Failed to restore ${player.name}'s game mode: ${e}`);
    playersInPhaseMode.delete(player.id);
  }
}
function logPlayerDebugInfo(player) {
  if (!config2.debugMessages || system2.currentTick % config2.debugUpdateInterval !== 0) {
    return;
  }
  const currentPos = player.location;
  const playerData = playersInPhaseMode.get(player.id);
  const isInPhaseMode = playerData && player.getGameMode() === GameMode2.spectator;
  const lastPos = playerData ? playerData.lastPosition : currentPos;
  try {
    const speed = calculatePlayerSpeed(player, lastPos);
    const speedColor = speed > config2.speedThresholdBps ? "\xA7a" : speed > config2.exitSpeedThresholdBps ? "\xA7e" : "\xA7c";
    world2.sendMessage(
      `\xA77${player.name}: speed=${speedColor}${speed.toFixed(2)} \xA77b/s, isGliding=${player.isGliding ? "\xA7aYes" : "\xA7cNo"}, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "\xA7aYES" : "\xA7cNO"}`
    );
  } catch (e) {
    world2.sendMessage(
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
    previousGameMode: player.getGameMode()
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
  } catch (e) {
    if (config2.debugMessages) {
      world2.sendMessage(`\xA7c${player.name}: ${e.message}`);
    }
  }
}
function updateRegularPlayer(player) {
  try {
    let playerData = playersInPhaseMode.get(player.id) || initializePlayerTracking(player);
    const currentSpeed = calculatePlayerSpeed(player, playerData.lastPosition);
    playerData.lastPosition = player.location;
    playerData.previousSpeed = currentSpeed;
    if (currentSpeed > config2.speedThresholdBps) {
      if (config2.debugMessages) {
        world2.sendMessage(`\xA7e${player.name} triggered phase mode at ${currentSpeed.toFixed(1)} b/s`);
      }
      enterPhaseMode(player);
    } else if (!playersInPhaseMode.has(player.id)) {
      playersInPhaseMode.set(player.id, playerData);
    }
  } catch (e) {
    if (config2.debugMessages) {
      world2.sendMessage(`\xA7c${player.name}: ${e.message}`);
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
      world2.sendMessage(`\xA7cError updating player phase state: ${e}`);
    }
  }
}
function isPhaseModeCaused(player) {
  const phaseData = playersInPhaseMode.get(player.id);
  return !!phaseData && player.getGameMode() === GameMode2.spectator;
}
function updatePlayersInPhaseMode() {
  cleanupDisconnectedPlayers();
  const players = world2.getAllPlayers();
  for (const player of players) {
    try {
      if (player && player.id) {
        logPlayerDebugInfo(player);
        updatePlayerPhaseState(player);
      }
    } catch (err) {
      if (config2.debugMessages) {
        world2.sendMessage(`\xA7cError updating player: ${err}`);
      }
    }
  }
}
function cleanupDisconnectedPlayers() {
  const onlinePlayers = new Set(world2.getAllPlayers().map((p) => p.id));
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
          world2.sendMessage(`\xA77Removing player from phase tracking (${reason}): ${playerName}`);
        }
        playersInPhaseMode.delete(playerId);
      }
    } catch (e) {
      playersInPhaseMode.delete(playerId);
      if (config2.debugMessages) {
        world2.sendMessage(`\xA7cError during player cleanup: ${e}`);
      }
    }
  }
}
function updateAllSpeedometers() {
  for (const player of world2.getAllPlayers()) {
    try {
      if (player && player.id && player.isValid?.()) {
        enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, true);
      }
    } catch (e) {
      if (config2.debugMessages) {
        world2.sendMessage(`\xA7cError updating speedometer for ${player.name}: ${e}`);
      }
    }
  }
}
function updatePhaseConfig(newConfig) {
  config2 = {
    ...config2,
    ...newConfig
  };
  updateAllSpeedometers();
  if (config2.debugMessages) {
    world2.sendMessage(`\xA77Phase mode configuration updated:`);
    world2.sendMessage(`\xA77Speed threshold: \xA7f${config2.speedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world2.sendMessage(`\xA77Exit threshold: \xA7f${config2.exitSpeedThresholdBps.toFixed(1)} \xA77blocks/second`);
  }
}
function initializePhantomPhase(customConfig) {
  try {
    if (customConfig) {
      updatePhaseConfig(customConfig);
    }
    world2.sendMessage("\xA72Phantom Phase system activated!");
    world2.sendMessage(`\xA77Phase speed threshold: \xA7f${config2.speedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world2.sendMessage(`\xA77Exit speed threshold: \xA7f${config2.exitSpeedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world2.sendMessage(`\xA77Mode change delay: \xA7f${config2.inactiveFramesThreshold} \xA77frames`);
    playersInPhaseMode.clear();
    for (const player of world2.getAllPlayers()) {
      try {
        if (player && player.id && player.isValid?.() !== false) {
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, false);
          if (!playersInPhaseMode.has(player.id) && player.getGameMode() !== GameMode2.creative && player.getGameMode() !== GameMode2.spectator) {
            playersInPhaseMode.set(player.id, initializePlayerTracking(player));
          }
        }
      } catch (playerError) {
        world2.sendMessage(`\xA7cError initializing player ${player?.name || "unknown"}: ${playerError}`);
      }
    }
    try {
      if (updateIntervalId !== void 0) {
        system2.clearRun(updateIntervalId);
        updateIntervalId = void 0;
      }
    } catch (e) {
      world2.sendMessage(`\xA7cWarning: Could not clear previous update interval: ${e}`);
    }
    updateIntervalId = system2.runInterval(updatePlayersInPhaseMode, config2.speedCheckInterval);
    world2.afterEvents.playerJoin.subscribe((event) => {
      try {
        const playerId = event.playerId;
        const player = world2.getAllPlayers().find((p) => p.id === playerId);
        if (player && player.id) {
          enableSpeedometer(player, config2.speedThresholdBps, config2.exitSpeedThresholdBps, false);
          if (player.getGameMode() !== GameMode2.creative && player.getGameMode() !== GameMode2.spectator) {
            playersInPhaseMode.set(player.id, initializePlayerTracking(player));
          }
        }
      } catch (e) {
        world2.sendMessage(`\xA7cError setting up new player: ${e}`);
      }
    });
    if (updateIntervalId === void 0) {
      world2.sendMessage(`\xA7cWARNING: Failed to create update interval`);
    } else {
      world2.sendMessage(`\xA7aPhantom Phase system is now monitoring player speeds (interval ID: ${updateIntervalId})`);
    }
    system2.runTimeout(updatePlayersInPhaseMode, 1);
    return true;
  } catch (e) {
    world2.sendMessage(`\xA7cFailed to initialize Phantom Phase system: ${e}`);
    return false;
  }
}

// scripts/main.ts
var ticksSinceLoad = 0;
function mainTick() {
  ticksSinceLoad++;
  if (ticksSinceLoad === 60) {
    world3.sendMessage("\xA76Phantom Phase system with speedometer2...");
    initialize();
  }
  system3.run(mainTick);
}
function initialize() {
  initializePhantomPhase({
    speedThresholdBps: 25,
    // Enter phase mode at this speed (blocks/second)
    exitSpeedThresholdBps: 7,
    // Exit phase mode below this speed
    inactiveFramesThreshold: 20,
    // Wait this many frames below exit speed before leaving phase mode
    debugMessages: true,
    // Show debug messages
    preserveInventory: true
    // Don't lose inventory during mode changes
  });
}
system3.run(mainTick);

//# sourceMappingURL=../debug/main.js.map
