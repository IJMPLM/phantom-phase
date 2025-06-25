import { system, world, Player } from "@minecraft/server";

/**
 * Configuration for phantom spawn monitoring
 */
interface PhantomSpawnerConfig {
  debugMode: boolean;
  minYLevel: number;
  rollTicks: number;
  nightStartTicks: number;
  testingMode?: boolean;
}

// Default configuration
const config: PhantomSpawnerConfig = {
  debugMode: true,
  minYLevel: 64,
  rollTicks: 20, //
  nightStartTicks: 13000,
  testingMode: true, // Enable testing mode by default for easier debugging
};

// Player data storage
interface PlayerData {
  daysSinceLastRest: number;
  spawnsThisDay: number;
  lastDayChecked: number;
  lastNightChecked: number;
}

// Maps to store player-specific data
const playerDataMap = new Map<string, PlayerData>();

// intervalIds
let phaseRollIntervalId: number;

/**
 * Check if player has sky access where they are
 */
function hasSkyAccess(player: Player): boolean {
  try {
    const location = player.location;

    // Check blocks above player up to build limit
    for (let y = Math.floor(location.y) + 1; y <= 256; y++) {
      const blockAbove = player.dimension.getBlock({
        x: Math.floor(location.x),
        y: y,
        z: Math.floor(location.z),
      });

      if (blockAbove && !blockAbove.isAir) {
        return false;
      }
    }
    return true;
  } catch (error) {
    // If there's an error, default to having sky access
    return true;
  }
}
/**
 * Get player data, create if doesn't exist
 */
function getPlayerData(playerId: string): PlayerData {
  if (!playerDataMap.has(playerId)) {
    playerDataMap.set(playerId, {
      daysSinceLastRest: 0,
      spawnsThisDay: 0,
      lastDayChecked: 0,
      lastNightChecked: 0,
    });
  }
  return playerDataMap.get(playerId)!;
}

/**
 * Day check function - runs once per day
 */
function performDayCheck(playerSlept: boolean) {
  const currentDay = world.getDay();
  const players = world.getPlayers();

  for (const player of players) {
    const playerData = getPlayerData(player.id);

    if (playerData.lastDayChecked < currentDay) {
      // Reset spawns for the day
      playerData.spawnsThisDay = 0;

      // Check if player slept
      if (playerSlept) {
        playerData.daysSinceLastRest = 0;
        player.setDynamicProperty("phantom-phase:daysSinceLastRest", 0);
        // clear target tag
        player.removeTag("phase_target");
        if (config.debugMode) {
          player.sendMessage("§bYou slept! Days since last rest reset to 0 and cleared tag");
        }
      } else {
        // Player didn't sleep, increment counter with persistence
        const dynamicPropertySafe = player.getDynamicProperty("phantom-phase:daysSinceLastRest");
        if (typeof dynamicPropertySafe == "number") {
          playerData.daysSinceLastRest = Math.max(playerData.daysSinceLastRest, dynamicPropertySafe);
        }
        playerData.daysSinceLastRest++;
        player.setDynamicProperty("phantom-phase:daysSinceLastRest", playerData.daysSinceLastRest);

        if (config.debugMode) {
          player.sendMessage(
            `§bYou did not sleep! Days since last rest incremented to ${playerData.daysSinceLastRest}`
          );
        }
      }
    }
    playerData.lastDayChecked = currentDay;
  }
  if (config.debugMode) {
    world.sendMessage("§6Day check completed");
  }
}
/**
 * Night check function - runs once per night for optimization
 */
function performNightCheck() {
  const currentNight = world.getDay();
  const players = world.getPlayers();

  // Check if any player has daysSinceLastRest >= 4
  let eligiblePlayers: Player[] = [];

  for (const player of players) {
    const playerData = getPlayerData(player.id);

    // Only run if we haven't checked this night already
    if (playerData.daysSinceLastRest >= 4) {
      eligiblePlayers.push(player);
    }
    playerData.lastNightChecked = currentNight;
  }
  // If no eligible players, mark night check as complete (optimization)
  if (eligiblePlayers.length === 0) {
    if (config.debugMode) {
      world.sendMessage("§7No players eligible for phase spawning this night");
    }
  } else {
    if (config.debugMode) {
      world.sendMessage("§6Night check completed - players eligible for phase spawning");
    }
    performPhaseSpawnRoll(eligiblePlayers);
  }
}
/**
 * Phase spawn roll function - called every 2000 ticks during night
 */
function performPhaseSpawnRoll(players: Player[]) {
  // Clear any existing phase roll interval first
  if (phaseRollIntervalId !== undefined) {
    system.clearRun(phaseRollIntervalId);
  }

  // Start the phase roll interval
  phaseRollIntervalId = system.runInterval(() => {
    const time = world.getTimeOfDay();

    // Check if it's still nighttime
    if (time >= config.nightStartTicks && time < 24000) {
      if (config.debugMode) {
        world.sendMessage(`§7Calling phase roll since still night (time: ${time})`);
      }

      for (let i = players.length - 1; i >= 0; i--) {
        const player = players[i];

        const playerData = getPlayerData(player.id);

        // Calculate max spawns per night: daysSinceLastRest - 3
        const maxSpawnsPerNight = Math.max(0, playerData.daysSinceLastRest - 3);

        // Check if we've reached max spawns for tonight
        if (playerData.spawnsThisDay >= maxSpawnsPerNight) {
          if (config.debugMode) {
            player.sendMessage(`§7Maximum phase spawns reached for tonight (${maxSpawnsPerNight})`);
          }
          players.splice(i, 1);
          continue;
        }

        // Check phase spawn conditions (blocked phantom spawn conditions)
        const belowMinY = player.location.y < config.minYLevel;
        const noSkyAccess = !hasSkyAccess(player);

        if (belowMinY || noSkyAccess) {
          if (config.debugMode) {
            player.sendMessage("§7Phase spawn roll happened");
          }

          // Calculate spawn chance: 0.25 * (daysSinceLastRest - 3)
          const spawnChance = 0.25 * (playerData.daysSinceLastRest - 3);
          const roll = Math.random();
          const spawnSuccessful = roll <= spawnChance;

          // Spawn phase entity if successful
          if (spawnSuccessful) {
            try {
              spawnPhase(player);
              player.sendMessage("§c⚡ Phase entity spawned 50 blocks above due to blocked phantom conditions!");
              playerData.spawnsThisDay++;
              player.addTag("phase_target");
            } catch (error) {
              if (config.debugMode) {
                player.sendMessage(`§cError spawning phase entity: ${error}`);
              }
            }
          } else {
            if (config.debugMode) {
              player.sendMessage(
                `§c⚡ Phase roll failed, roll = ${(roll * 100).toFixed(1)}%, chance = ${(spawnChance * 100).toFixed(
                  1
                )}%`
              );
            }
          }
        }
      }

      // If no players left, stop the interval
      if (players.length === 0) {
        system.clearRun(phaseRollIntervalId);
        if (config.debugMode) {
          world.sendMessage("§7No more eligible players, stopping phase roll");
        }
      }
    } else {
      // It's daytime, stop the interval
      system.clearRun(phaseRollIntervalId);
      if (config.debugMode) {
        world.sendMessage(`§7Daytime detected (${time}), stopping phase roll`);
      }
    }
  }, config.rollTicks);
}
function spawnPhase(player: Player) {
  const phasePos = {
    x: player.location.x,
    y: player.location.y + 50,
    z: player.location.z,
  };
  player.dimension.spawnEntity("creeper", phasePos);
}

/**
 * Initialize the phantom spawner system
 */
export function startPhantomSpawner(customConfig?: Partial<PhantomSpawnerConfig>) {
  if (customConfig) {
    Object.assign(config, customConfig);
  }
  const players = world.getPlayers();
  for (const player of players) {
    const playerData = getPlayerData(player.id);
  }
  world.sendMessage("phase-spawner: Players init");

  let tickCheckId: number | undefined;
  function tickCheck(playerSlept: boolean) {
    if (tickCheckId !== undefined) system.clearRun(tickCheckId);

    const time = world.getTimeOfDay();
    let nextInterval = 20;

    if (time >= 0 && time < config.nightStartTicks) {
      nextInterval = 13000 - time; // wait until next sunset
      performDayCheck(playerSlept);
      world.sendMessage(`§7Doing day check at ${time} next call within ${nextInterval} ticks`);
    } else {
      nextInterval = (24000 - time + 0) % 24000; // wait until next sunrise
      performNightCheck();
      world.sendMessage(`§7Doing night check at ${time} next call within ${nextInterval} ticks`);
    }
    tickCheckId = system.runInterval(() => tickCheck(false), nextInterval);
  }
  tickCheck(false);
  world.sendMessage("phase-spawner: tickCheck called");

  world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    const block = event.block;
    const player = event.player;
    let timeBefore: number, timeAfter: number;
    let playerSlept: boolean;
    if (block.typeId.includes("bed")) {
      player.sendMessage("🛏️ Interacted with a bed block!");
      timeBefore = world.getTimeOfDay();
      system.runTimeout(() => {
        timeAfter = world.getTimeOfDay();
        if (timeAfter != timeBefore + 140) {
          playerSlept = true;
          world.sendMessage("phase-spawner: player Slept");
          tickCheck(playerSlept);
          world.sendMessage("phase-spawner: tickCheck called");
        } else {
          playerSlept = false;
          world.sendMessage("phase-spawner: player did not Sleep");
          tickCheck(playerSlept);
          world.sendMessage("phase-spawner: tickCheck called");
        }
      }, 140);
    }
  });
  return true;
}
