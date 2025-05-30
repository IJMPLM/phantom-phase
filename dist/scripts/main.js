// scripts/main.ts
import { world as world2, system as system2 } from "@minecraft/server";

// scripts/phase-mode.ts
import { world, system, GameMode } from "@minecraft/server";
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
var config = { ...DEFAULT_CONFIG };
var updateIntervalId;
function calculatePlayerSpeed(player, previousPosition, intervalTicks = config.speedCheckInterval) {
  const velocity = player.getVelocity();
  return 17 * Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
}
function enterPhaseMode(player) {
  if (player.getGameMode() === GameMode.spectator) {
    if (config.debugMessages) {
      world.sendMessage(`\xA7e${player.name} is already in spectator mode, not entering phase mode again.`);
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
    system.runTimeout(() => {
      try {
        if (player && player.id && !player.isValid?.()) {
          world.sendMessage(`\xA7cPlayer ${player.name} is no longer valid, aborting phase mode entry`);
          playersInPhaseMode.delete(player.id);
          return;
        }
        if (player.getGameMode() !== GameMode.spectator) {
          player.setGameMode(GameMode.spectator);
          world.sendMessage(`\xA7b${player.name} is phasing out of reality! (from ${previousMode} mode)`);
        }
      } catch (err) {
        world.sendMessage(`\xA7cERROR: Failed to set spectator mode: ${err}`);
      }
    }, config.gameModeSwitchDelay);
  } catch (e) {
    world.sendMessage(`\xA7cERROR: Failed to set ${player.name} to spectator mode: ${e}`);
  }
}
function exitPhaseMode(player) {
  try {
    const phaseData = playersInPhaseMode.get(player.id);
    if (!phaseData) {
      world.sendMessage(`\xA7cWARNING: No phase data found for ${player.name} when trying to exit phase mode`);
      return;
    }
    const targetMode = phaseData.previousGameMode ?? GameMode.survival;
    const playerName = player.name;
    const playerId = player.id;
    playersInPhaseMode.delete(playerId);
    system.runTimeout(() => {
      try {
        if (!player || !player.id || !player.isValid?.()) {
          world.sendMessage(`\xA7cPlayer ${playerName} is no longer valid, aborting phase mode exit`);
          return;
        }
        const currentMode = player.getGameMode();
        if (currentMode === GameMode.spectator) {
          player.setGameMode(targetMode);
          world.sendMessage(`\xA7a${playerName} has returned to reality! (back to ${targetMode} mode)`);
        } else if (currentMode !== targetMode) {
          world.sendMessage(`\xA7e${playerName} is in ${currentMode} mode, restoring to ${targetMode} mode`);
          player.setGameMode(targetMode);
        } else {
          world.sendMessage(`\xA7e${playerName} is already in ${targetMode} mode`);
        }
      } catch (err) {
        world.sendMessage(`\xA7cERROR: Failed to restore game mode for ${playerName}: ${err}`);
      }
    }, config.gameModeSwitchDelay);
  } catch (e) {
    world.sendMessage(`\xA7cERROR: Failed to restore ${player.name}'s game mode: ${e}`);
    playersInPhaseMode.delete(player.id);
  }
}
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
    const speedColor = speed > config.speedThresholdBps ? "\xA7a" : speed > config.exitSpeedThresholdBps ? "\xA7e" : "\xA7c";
    world.sendMessage(
      `\xA77${player.name}: speed=${speedColor}${speed.toFixed(2)} \xA77b/s, isGliding=${player.isGliding ? "\xA7aYes" : "\xA7cNo"}, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "\xA7aYES" : "\xA7cNO"}`
    );
  } catch (e) {
    world.sendMessage(
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
    if (currentSpeed < config.exitSpeedThresholdBps) {
      phaseData.inactiveFrames++;
      if (phaseData.inactiveFrames >= config.inactiveFramesThreshold) {
        exitPhaseMode(player);
      }
    } else {
      phaseData.inactiveFrames = 0;
    }
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`\xA7c${player.name}: ${e.message}`);
    }
  }
}
function updateRegularPlayer(player) {
  try {
    let playerData = playersInPhaseMode.get(player.id) || initializePlayerTracking(player);
    const currentSpeed = calculatePlayerSpeed(player, playerData.lastPosition);
    playerData.lastPosition = player.location;
    playerData.previousSpeed = currentSpeed;
    if (currentSpeed > config.speedThresholdBps) {
      if (config.debugMessages) {
        world.sendMessage(`\xA7e${player.name} triggered phase mode at ${currentSpeed.toFixed(1)} b/s`);
      }
      enterPhaseMode(player);
    } else if (!playersInPhaseMode.has(player.id)) {
      playersInPhaseMode.set(player.id, playerData);
    }
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`\xA7c${player.name}: ${e.message}`);
    }
  }
}
function updatePlayerPhaseState(player) {
  try {
    const currentGameMode = player.getGameMode();
    const isTracked = playersInPhaseMode.has(player.id);
    if (!isTracked && currentGameMode === GameMode.spectator && !isPhaseModeCaused(player)) {
      return;
    }
    const phaseData = playersInPhaseMode.get(player.id);
    if (phaseData && currentGameMode === GameMode.spectator) {
      updateExistingPhasePlayer(player, phaseData);
    } else {
      updateRegularPlayer(player);
    }
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`\xA7cError updating player phase state: ${e}`);
    }
  }
}
function isPhaseModeCaused(player) {
  const phaseData = playersInPhaseMode.get(player.id);
  return !!phaseData && player.getGameMode() === GameMode.spectator;
}
function updatePlayersInPhaseMode() {
  cleanupDisconnectedPlayers();
  const players = world.getAllPlayers();
  for (const player of players) {
    try {
      if (player && player.id) {
        logPlayerDebugInfo(player);
        updatePlayerPhaseState(player);
      }
    } catch (err) {
      if (config.debugMessages) {
        world.sendMessage(`\xA7cError updating player: ${err}`);
      }
    }
  }
}
function cleanupDisconnectedPlayers() {
  const onlinePlayers = new Set(world.getAllPlayers().map((p) => p.id));
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
        if (config.debugMessages) {
          const playerName = data.player?.name || "Unknown";
          world.sendMessage(`\xA77Removing player from phase tracking (${reason}): ${playerName}`);
        }
        playersInPhaseMode.delete(playerId);
      }
    } catch (e) {
      playersInPhaseMode.delete(playerId);
      if (config.debugMessages) {
        world.sendMessage(`\xA7cError during player cleanup: ${e}`);
      }
    }
  }
}
function updatePhaseConfig(newConfig) {
  config = {
    ...config,
    ...newConfig
  };
  if (config.debugMessages) {
    world.sendMessage(`\xA77Phase mode configuration updated:`);
    world.sendMessage(`\xA77Speed threshold: \xA7f${config.speedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world.sendMessage(`\xA77Exit threshold: \xA7f${config.exitSpeedThresholdBps.toFixed(1)} \xA77blocks/second`);
  }
}
function initializePhantomPhase(customConfig) {
  try {
    if (customConfig) {
      updatePhaseConfig(customConfig);
    }
    world.sendMessage("\xA72Phantom Phase system activated!");
    world.sendMessage(`\xA77Phase speed threshold: \xA7f${config.speedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world.sendMessage(`\xA77Exit speed threshold: \xA7f${config.exitSpeedThresholdBps.toFixed(1)} \xA77blocks/second`);
    world.sendMessage(`\xA77Mode change delay: \xA7f${config.inactiveFramesThreshold} \xA77frames`);
    playersInPhaseMode.clear();
    for (const player of world.getAllPlayers()) {
      try {
        if (player && player.id && player.isValid?.() !== false && !playersInPhaseMode.has(player.id) && player.getGameMode() !== GameMode.creative && player.getGameMode() !== GameMode.spectator) {
          playersInPhaseMode.set(player.id, initializePlayerTracking(player));
        }
      } catch (playerError) {
        world.sendMessage(`\xA7cError initializing player ${player?.name || "unknown"}: ${playerError}`);
      }
    }
    try {
      if (updateIntervalId !== void 0) {
        system.clearRun(updateIntervalId);
        updateIntervalId = void 0;
      }
    } catch (e) {
      world.sendMessage(`\xA7cWarning: Could not clear previous update interval: ${e}`);
    }
    updateIntervalId = system.runInterval(updatePlayersInPhaseMode, config.speedCheckInterval);
    if (updateIntervalId === void 0) {
      world.sendMessage(`\xA7cWARNING: Failed to create update interval`);
    } else {
      world.sendMessage(`\xA7aPhantom Phase system is now monitoring player speeds (interval ID: ${updateIntervalId})`);
    }
    system.runTimeout(updatePlayersInPhaseMode, 1);
    return true;
  } catch (e) {
    world.sendMessage(`\xA7cFailed to initialize Phantom Phase system: ${e}`);
    return false;
  }
}

// scripts/main.ts
var ticksSinceLoad = 0;
function mainTick() {
  ticksSinceLoad++;
  if (ticksSinceLoad === 60) {
    world2.sendMessage("\xA76Phantom Phase system starting minBps: 8...");
    initialize();
  }
  system2.run(mainTick);
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
system2.run(mainTick);

//# sourceMappingURL=../debug/main.js.map
