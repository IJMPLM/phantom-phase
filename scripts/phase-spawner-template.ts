import { system, world, Player } from "@minecraft/server";

/**
 * Configuration for phantom spawn monitoring
 */
interface PhantomSpawnerConfig {
  /**
   * Debug mode, shows additional messages
   */
  debugMode: boolean;

  /**
   * Minimum Y level for phantoms to spawn (for sky access check)
   */
  minYLevel: number;

  /**
   * Blockages required before spawning a phase entity
   */
  blockedSpawnsBeforePhase: number;

  /**
   * Check interval in ticks (default: 2000 ticks = 100 seconds)
   */
  checkIntervalTicks: number;

  /**
   * Night time start in ticks
   */
  nightStartTicks: number;

  /**
   * Night time end in ticks
   */
  nightEndTicks: number;

  /**
   * Testing mode - bypasses night time check for easier testing
   */
  testingMode?: boolean;
}

// Default configuration
const config: PhantomSpawnerConfig = {
  debugMode: true,
  minYLevel: 64,
  blockedSpawnsBeforePhase: 3,
  checkIntervalTicks: 2000, // 100 seconds (2000 ticks)
  nightStartTicks: 13000,
  nightEndTicks: 23000,
  testingMode: true, // Enable testing mode by default for easier debugging
};

// Player data storage
interface PlayerData {
  blockedSpawns: number;
  spawnsThisNight: number;
  lastSpawnAttemptTime: number;
  insomniaDays: number;
  lastDayUpdated: number; // Track which day insomnia was last updated
}

// Maps to store player-specific data
const playerDataMap = new Map<string, PlayerData>();

function isNightTime(): boolean {
  // Get current world time
  let currentTime;
  try {
    currentTime = world.getTimeOfDay();
  } catch (error) {
    currentTime = world.getTimeOfDay();
    world.sendMessage("Time cannot be retrieved");
  }

  const isNight = currentTime > config.nightStartTicks && currentTime < config.nightEndTicks;

  if (config.debugMode) {
    world.sendMessage(`§7Current time: ${currentTime}, Night time: ${isNight ? "Yes" : "No"}`);
  }

  return isNight;
}

function hasSkyAccess(player: Player): boolean {
  try {
    const location = player.location;

    // Check 20 blocks above player
    for (let y = 0; location.y + y <= 256; y++) {
      const blockAbove = player.dimension.getBlock({
        x: Math.floor(location.x),
        y: Math.floor(location.y) + y,
        z: Math.floor(location.z),
      });

      if (!blockAbove?.isAir) {
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
      blockedSpawns: 0,
      spawnsThisNight: 0,
      lastSpawnAttemptTime: 0,
      insomniaDays: 0,
      lastDayUpdated: 0, // Initialize to 0 so first day will always trigger update
    });
  }
  return playerDataMap.get(playerId)!;
}

/**
 * Initialize the phantom spawner system
 */
export function startPhantomSpawner(customConfig?: Partial<PhantomSpawnerConfig>) {
  // Apply custom configuration if provided
  if (customConfig) {
    Object.assign(config, customConfig);
  }

  // Run the spawn check at regular intervals
  const intervalId = system.runInterval(
    () => {
      // Skip if no players
      const players = world.getPlayers();
      if (players.length === 0) return;

      // Check if it's night time
      const isNight = isNightTime();
      if (!isNight) return;

      for (const player of players) {
        // Check if player has insomnia tag
        const hasInsomnia = player.hasTag("insomnia");
        if (!hasInsomnia) {
          // Reset player data if they don't have insomnia
          if (playerDataMap.has(player.id)) {
            const insomniaTag = player.getTags().find((tag) => tag.startsWith("insomnia_days:"));
            if (insomniaTag) {
              player.removeTag(insomniaTag);
              player.addTag("insomnia_days:0");
            }
            playerDataMap.delete(player.id);
            if (config.debugMode) {
              player.sendMessage("§7No insomnia detected. Phantom counters reset.");
            }
          }
          continue;
        } // Get player data
        const playerData = getPlayerData(player.id);

        // Read insomnia_days from tag and update playerData
        let insomniaDays = 1; // Default value
        const insomniaTag = player.getTags().find((tag) => tag.startsWith("insomnia_days:"));
        if (insomniaTag) {
          const days = parseInt(insomniaTag.split(":")[1]);
          if (!isNaN(days)) {
            insomniaDays = days;
          }
        } else {
          // If no tag exists, initialize it
          player.addTag("insomnia_days:1");
          insomniaDays = 1;
        }

        // Update playerData with current insomnia days
        playerData.insomniaDays = insomniaDays;

        // Calculate maximum spawns per night based on insomnia days
        const maxSpawnsPerNight = Math.max(0, insomniaDays - 1);

        // Check if we've reached maximum spawns for tonight
        if (playerData.spawnsThisNight >= maxSpawnsPerNight) {
          if (config.debugMode) {
            player.sendMessage(`§7Maximum phantom spawns reached for tonight (${maxSpawnsPerNight})`);
          }
          continue;
        }

        // Check spawn conditions
        const aboveMinY = player.location.y >= config.minYLevel;
        const skyAccessible = hasSkyAccess(player);

        if (config.debugMode) {
          player.sendMessage(
            `§7Insomnia Days: ${insomniaDays}, Above Min Y: ${aboveMinY ? "§a✓" : "§c✗"}, ` +
              `Sky Access: ${skyAccessible ? "§a✓" : "§c✗"}`
          );
        }

        // Calculate spawn chance: 0.25 * insomnia days
        const spawnChance = 0.25 * insomniaDays;
        const roll = Math.random();
        const spawnSuccessful = roll <= spawnChance;

        if (config.debugMode) {
          player.sendMessage(
            `§7Phantom Spawn Roll: ${spawnSuccessful ? "§aSuccess" : "§cFail"} ` +
              `(${(roll * 100).toFixed(1)}% vs ${(spawnChance * 100).toFixed(1)}% chance)`
          );
        } // Check if sky access is blocked, regardless of other conditions
        if (!aboveMinY || !skyAccessible) {
          // Always increment the blocked spawns counter when sky access is blocked
          playerData.blockedSpawns++;
          player.sendMessage(
            `§e⚠ Phantom spawn blocked! Counter: ${playerData.blockedSpawns}/${config.blockedSpawnsBeforePhase}`
          );

          // Spawn phase entity after threshold reached
          if (playerData.blockedSpawns >= config.blockedSpawnsBeforePhase) {
            const phasePos = {
              x: player.location.x,
              y: 80, // Spawn high in the sky
              z: player.location.z,
            };

            try {
              // Spawn the entity
              player.dimension.spawnEntity("phantom-phase:phase", phasePos);
              player.sendMessage("§c💥 Phase entity spawned above due to blocked phantom spawns!");

              // Reset counter and increment spawns for tonight
              playerData.blockedSpawns = 0;
              playerData.spawnsThisNight++;
            } catch (error) {
              // Handle spawn error
              if (config.debugMode) {
                player.sendMessage(`§cError spawning phase entity: ${error}`);
              }
            }
          }
        } // If spawn would succeed normally (all conditions met)
        else if (spawnSuccessful && aboveMinY && skyAccessible) {
          if (config.debugMode) {
            player.sendMessage("§7Phantom would spawn here (all conditions met)");
          }
        }
      }
    },
    config.testingMode ? 20 : 100
  ); // Run more frequently in testing mode
  // Reset spawns per night counter at daytime and update insomnia_days once per day
  system.runInterval(() => {
    if (config.debugMode) {
      const players = world.getPlayers();
      for (const player of players) {
        player.addTag("insomnia");
      }
    }

    const isDay = !isNightTime();
    if (isDay) {
      // Get current day (world time divided by 24000 ticks per day)
      const currentDay = Math.floor(world.getTimeOfDay() / 24000);

      for (const [playerId, data] of playerDataMap.entries()) {
        const player = world.getPlayers().find((p) => p.id === playerId);
        if (player && player.hasTag("insomnia")) {
          // Only update insomnia_days once per day
          if (data.lastDayUpdated < currentDay) {
            // Get current insomnia_days from tag
            const insomniaTag = player.getTags().find((tag) => tag.startsWith("insomnia_days:"));
            let insomniaDays = 1;

            if (insomniaTag) {
              const days = parseInt(insomniaTag.split(":")[1]);
              if (!isNaN(days)) {
                insomniaDays = days + 1; // Increment by 1 day
                player.removeTag(insomniaTag); // Remove old tag
              }
            }

            // Add updated tag and update player data
            player.addTag(`insomnia_days:${insomniaDays}`);
            data.insomniaDays = insomniaDays;
            data.lastDayUpdated = currentDay;

            if (config.debugMode) {
              player.sendMessage(`§7New day began, insomnia days updated to ${insomniaDays}`);
            }
          }
        }

        // Reset nightly spawn counter if it was active
        if (data.spawnsThisNight > 0) {
          data.spawnsThisNight = 0;
          if (config.debugMode && player) {
            player.sendMessage("§7Nightly phantom spawn counter reset");
          }
        }
      }

      // Clean up data for players without insomnia
      for (const [playerId, data] of playerDataMap.entries()) {
        const player = world.getPlayers().find((p) => p.id === playerId);
        if (player && !player.hasTag("insomnia")) {
          const insomniaTag = player.getTags().find((tag) => tag.startsWith("insomnia_days:"));
          if (insomniaTag) {
            player.removeTag(insomniaTag);
          }
          playerDataMap.delete(playerId);
          if (config.debugMode) {
            player.sendMessage("§7No insomnia detected. Phantom counters reset.");
          }
        }
      }
    }
  }, 1200); // Check every minute

  if (config.debugMode) {
    world.sendMessage("§6Phantom Spawner system started" + (config.testingMode ? " (TESTING MODE ENABLED)" : ""));
  }

  return intervalId;
}
