import { system, world, EntityTypes } from "@minecraft/server";

/**
 * Configuration for phantom spawn monitoring
 */
interface PhantomSpawnerConfig {
  /**
   * Debug mode, shows additional messages
   */
  debugMode: boolean;

  /**
   * Minimum days without sleep for phantoms to spawn
   */
  minDaysWithoutSleep: number;

  /**
   * Minimum Y level for phantoms to spawn
   */
  minYLevel: number;

  /**
   * Blockages required before spawning a creeper
   */
  blockedSpawnsBeforeCreeper: number;

  /**
   * Check interval in ticks (1-2 minutes is 1200-2400 ticks)
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
}

// Default configuration
const config: PhantomSpawnerConfig = {
  debugMode: true,
  minDaysWithoutSleep: 3,
  minYLevel: 64,
  blockedSpawnsBeforeCreeper: 3,
  checkIntervalTicks: 1200, // 1 minute (60 seconds × 20 ticks/second)
  nightStartTicks: 13000,
  nightEndTicks: 23000,
};

// Stores phantom spawn counter per player
const phantomSpawnCounter = new Map<string, number>();

// Stores last check time to implement 1-2 minute random intervals
const lastSpawnAttemptTime = new Map<string, number>();

/**
 * Calculate phantom spawn chance based on days without sleep
 * Day 3: 0% (no spawns)
 * Day 4: 25%
 * Day 5: 37.5%
 * Day 6+: 50%
 * @param daysWithoutSleep Days player has gone without sleep
 * @returns Spawn chance as a percentage (0-100)
 */
function calculatePhantomSpawnChance(daysWithoutSleep: number): number {
  if (daysWithoutSleep < config.minDaysWithoutSleep) return 0;
  if (daysWithoutSleep === config.minDaysWithoutSleep) return 0; // Day 3 has 0% chance
  if (daysWithoutSleep === config.minDaysWithoutSleep + 1) return 25; // Day 4 has 25% chance
  if (daysWithoutSleep === config.minDaysWithoutSleep + 2) return 37.5; // Day 5 has 37.5% chance
  return 50; // Day 6+ has 50% chance
}

/**
 * Determine if it's currently night time
 * @returns True if it's night time
 */
function isNightTime(): boolean {
  const currentTime = system.currentTick % 24000; // Use system ticks as an approximation
  return currentTime > config.nightStartTicks && currentTime < config.nightEndTicks;
}

/**
 * Determine if it's time to attempt a phantom spawn for a player
 * @param playerId The player's ID
 * @returns True if it's time to attempt a spawn
 */
function isTimeToSpawnAttempt(playerId: string): boolean {
  const currentTime = system.currentTick;
  const lastAttempt = lastSpawnAttemptTime.get(playerId) || 0;

  // Random interval between 1-2 minutes (1200-2400 ticks)
  const randomInterval = Math.floor(Math.random() * 1200) + 1200;

  if (currentTime - lastAttempt >= randomInterval) {
    lastSpawnAttemptTime.set(playerId, currentTime);
    return true;
  }

  return false;
}

/**
 * Initialize the phantom spawner system
 * @param customConfig Optional custom configuration
 */
export function startPhantomSpawner(customConfig?: Partial<PhantomSpawnerConfig>) {
  // Apply custom configuration if provided
  if (customConfig) {
    Object.assign(config, customConfig);
  }

  // Run the spawn check at regular intervals
  const intervalId = system.runInterval(() => {
    const players = world.getPlayers();

    for (const player of players) {
      // In Bedrock API, we'll use a proxy for insomnia through bad_omen effect
      // since insomnia component may not be directly accessible
      const playerId = player.id;

      // Simulate insomnia component using bad_omen effect
      // We'll check if player has the bad_omen effect as a proxy for insomnia
      const hasInsomnia = player.hasTag("insomnia");
      const daysWithoutSleep = hasInsomnia ? 4 : 0; // Simulate 4 days without sleep if tag is present

      if (!hasInsomnia) {
        if (config.debugMode && phantomSpawnCounter.has(playerId)) {
          player.sendMessage("§7No insomnia effect detected.");
        }
        phantomSpawnCounter.delete(playerId);
        lastSpawnAttemptTime.delete(playerId);
        continue;
      } // Debug information about insomnia status
      if (config.debugMode) {
        // Use titleraw or title command instead since onScreenDisplay might not be available
        player.sendMessage(`§3Insomnia: ${daysWithoutSleep} days without sleep`);
      } // Reset counter if player sleeps
      if (daysWithoutSleep < config.minDaysWithoutSleep) {
        const counter = phantomSpawnCounter.get(playerId) || 0;
        if (counter > 0) {
          player.sendMessage("§b💤 Insomnia reset! Phantom counter cleared.");
          phantomSpawnCounter.set(playerId, 0);
        }
        continue;
      }

      // Only attempt spawns during night or if it's time for another attempt
      if (isNightTime() && isTimeToSpawnAttempt(playerId)) {
        // Calculate spawn chance based on days without sleep
        const spawnChance = calculatePhantomSpawnChance(daysWithoutSleep);
        const roll = Math.random() * 100;
        const successfulRoll = roll <= spawnChance; // Check all conditions for phantom spawning
        const playerLocation = player.location;
        if (!playerLocation) continue;

        const aboveSeaLevel = playerLocation.y >= config.minYLevel;
        // Get player's block and check sky access
        // In Bedrock API, we need to implement our own sky access check
        // For testing purposes, we'll check if there's a block directly above the player

        // Create a simple sky access check by checking blocks above
        let hasSkyAccess = true;
        try {
          // Check 20 blocks above player
          for (let y = 1; y <= 20; y++) {
            const blockAbove = player.dimension.getBlock({
              x: Math.floor(playerLocation.x),
              y: Math.floor(playerLocation.y) + y,
              z: Math.floor(playerLocation.z),
            });

            if (
              blockAbove &&
              blockAbove.typeId !== "minecraft:air" &&
              blockAbove.typeId !== "minecraft:void_air" &&
              blockAbove.typeId !== "minecraft:cave_air"
            ) {
              hasSkyAccess = false;
              break;
            }
          }
        } catch (error) {
          // If there's an error, default to having sky access
          hasSkyAccess = true;
        }

        // Debug info about phantom spawn attempt
        if (config.debugMode) {
          player.sendMessage(
            `§7Phantom Spawn Attempt: ${successfulRoll ? "§aSuccess" : "§cFail"} (${roll.toFixed(
              1
            )}/${spawnChance.toFixed(1)}%)`
          );
          player.sendMessage(
            `§7Conditions: Above Sea Level: ${aboveSeaLevel ? "§a✓" : "§c✗"}, Sky Access: ${
              hasSkyAccess ? "§a✓" : "§c✗"
            }`
          );
        }

        // Check if phantom should spawn but is blocked
        if (successfulRoll && aboveSeaLevel && !hasSkyAccess) {
          const currentCount = phantomSpawnCounter.get(playerId) || 0;
          const newCount = currentCount + 1;
          phantomSpawnCounter.set(playerId, newCount);

          player.sendMessage(`§e⚠ Phantom spawn blocked! Counter: ${newCount}/${config.blockedSpawnsBeforeCreeper}`);

          // Spawn creeper if counter reaches threshold
          if (newCount >= config.blockedSpawnsBeforeCreeper) {
            const creeperPos = { x: player.location.x, y: 256, z: player.location.z };
            player.dimension.spawnEntity("minecraft:creeper", creeperPos);
            player.sendMessage("§c💥 Creeper spawned above due to failed phantom spawns!");
            phantomSpawnCounter.set(playerId, 0); // Reset counter
          }
        }
        // Reset counter if a phantom would have successfully spawned (all conditions met)
        else if (successfulRoll && aboveSeaLevel && hasSkyAccess) {
          if (config.debugMode) {
            player.sendMessage("§7A phantom would have spawned here (all conditions met)");
          }
          // In a real game, a phantom would spawn here. Reset the counter.
          phantomSpawnCounter.set(playerId, 0);
        }
      }
    }
  }, 200); // Run every 10 seconds for more reliable debug feedback

  if (config.debugMode) {
    world.sendMessage("§6Phantom Spawner system started");
  }

  return intervalId;
}
