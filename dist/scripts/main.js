// scripts/main.ts
import { world as world2, system as system2 } from "@minecraft/server";

// scripts/phase-mode.ts
import { world, system, GameMode } from "@minecraft/server";
var playersInPhaseMode = /* @__PURE__ */ new Map();
var DEFAULT_CONFIG = {
  speedThresholdBps: 8,
  exitSpeedThresholdBps: 2,
  inactiveFramesThreshold: 20,
  ticksPerSecond: 60,
  speedCheckInterval: 1,
  debugUpdateInterval: 10,
  debugMessages: true,
  preserveInventory: true
};
var config = { ...DEFAULT_CONFIG };
function calculatePlayerSpeed(player, previousPosition, intervalTicks = config.speedCheckInterval) {
  const currentPosition = player.location;
  const dx = currentPosition.x - previousPosition.x;
  const dy = currentPosition.y - previousPosition.y;
  const dz = currentPosition.z - previousPosition.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const secondsFraction = intervalTicks * 60 / config.ticksPerSecond;
  return secondsFraction > 0 ? distance / secondsFraction : 0;
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
    player.setGameMode(GameMode.spectator);
    world.sendMessage(`\xA7b${player.name} is phasing out of reality! (from ${previousMode} mode)`);
    playersInPhaseMode.set(player.id, {
      player,
      lastPosition: player.location,
      previousSpeed: 0,
      inactiveFrames: 0,
      previousGameMode: previousMode
    });
  } catch (e) {
    world.sendMessage(`\xA7cERROR: Failed to set ${player.name} to spectator mode: ${e}`);
  }
}
function exitPhaseMode(player) {
  try {
    const phaseData = playersInPhaseMode.get(player.id);
    const targetMode = phaseData?.previousGameMode ?? GameMode.survival;
    player.setGameMode(targetMode);
    world.sendMessage(`\xA7a${player.name} has returned to reality! (back to ${targetMode} mode)`);
    playersInPhaseMode.delete(player.id);
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
  const speed = calculatePlayerSpeed(player, lastPos);
  const speedColor = speed > config.speedThresholdBps ? "\xA7a" : speed > config.exitSpeedThresholdBps ? "\xA7e" : "\xA7c";
  world.sendMessage(
    `\xA77${player.name}: speed=${speedColor}${speed.toFixed(2)} \xA77b/s, isGliding=${player.isGliding ? "\xA7aYes" : "\xA7cNo"}, gameMode=${player.getGameMode()}, phaseMode=${isInPhaseMode ? "\xA7aYES" : "\xA7cNO"}`
  );
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
}
function updateRegularPlayer(player) {
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
}
function updatePlayerPhaseState(player) {
  if (!playersInPhaseMode.has(player.id) && (player.getGameMode() === GameMode.creative || player.getGameMode() === GameMode.spectator)) {
    return;
  }
  const phaseData = playersInPhaseMode.get(player.id);
  if (phaseData && player.getGameMode() === GameMode.spectator) {
    updateExistingPhasePlayer(player, phaseData);
  } else {
    updateRegularPlayer(player);
  }
}
function updatePlayersInPhaseMode() {
  const players = world.getAllPlayers();
  for (const player of players) {
    logPlayerDebugInfo(player);
    updatePlayerPhaseState(player);
  }
  for (const [playerId, data] of playersInPhaseMode.entries()) {
    try {
      const _ = data.player.location;
    } catch (e) {
      playersInPhaseMode.delete(playerId);
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
  if (customConfig) {
    updatePhaseConfig(customConfig);
  }
  world.sendMessage("\xA72Phantom Phase system activated!");
  world.sendMessage(`\xA77Phase speed threshold: \xA7f${config.speedThresholdBps.toFixed(1)} \xA77blocks/second`);
  world.sendMessage(`\xA77Exit speed threshold: \xA7f${config.exitSpeedThresholdBps.toFixed(1)} \xA77blocks/second`);
  for (const player of world.getAllPlayers()) {
    if (!playersInPhaseMode.has(player.id) && player.getGameMode() !== GameMode.creative && player.getGameMode() !== GameMode.spectator) {
      playersInPhaseMode.set(player.id, initializePlayerTracking(player));
    }
  }
  system.runInterval(updatePlayersInPhaseMode, config.speedCheckInterval);
}

// scripts/main.ts
var ticksSinceLoad = 0;
function mainTick() {
  ticksSinceLoad++;
  if (ticksSinceLoad === 100) {
    world2.sendMessage("\xA76Phantom Phase system starting minBps: 8...");
    initialize();
  }
  system2.run(mainTick);
}
function initialize() {
  initializePhantomPhase({
    speedThresholdBps: 8,
    // Enter phase mode at this speed (blocks/second)
    exitSpeedThresholdBps: 2,
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
