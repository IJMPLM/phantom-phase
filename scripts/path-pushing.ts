import { system, world, EntityQueryOptions } from "@minecraft/server";

/**
 * Configuration options for path pushing system
 */
export interface PathPushingConfig {
  /**
   * Interval in ticks between each path push update
   * @default 5
   */
  updateIntervalTicks: number;

  /**
   * Force multiplier to apply when pushing entities
   * @default 0.5
   */
  forceMultiplier: number;

  /**
   * Entity identifier to target for pushing (e.g., "phantom-phase:phase")
   * @default "phantom-phase:phase"
   */
  targetEntityId: string;

  /**
   * Player tag to identify which players should be targeted
   * @default "phase_target"
   */
  playerTag: string;

  /**
   * Whether to show debug messages
   * @default false
   */
  debugMessages: boolean;
}

// Default configuration
const defaultConfig: PathPushingConfig = {
  updateIntervalTicks: 5,
  forceMultiplier: 0.5,
  targetEntityId: "phantom-phase:phase",
  playerTag: "phase_target",
  debugMessages: false,
};

let intervalId: number | undefined;
let currentConfig: PathPushingConfig = { ...defaultConfig };

/**
 * Updates the path pushing entities toward players
 */
function updatePathPushing() {
  const allPlayers = world.getPlayers();
  const overworld = world.getDimension("overworld");

  // Filter players to only those with the specific tag
  const targetPlayers = allPlayers.filter((player) => player.hasTag(currentConfig.playerTag));

  if (targetPlayers.length === 0) {
    if (currentConfig.debugMessages) {
      console.warn(`No players found with tag "${currentConfig.playerTag}"`);
    }
    return;
  }

  // Query entities by identifier instead of tag
  const entityQuery: EntityQueryOptions = { type: currentConfig.targetEntityId };
  const targetEntities = overworld.getEntities(entityQuery);

  if (targetEntities.length === 0) {
    if (currentConfig.debugMessages) {
      console.warn(`No entities found with identifier "${currentConfig.targetEntityId}"`);
    }
    return;
  }

  // For each target player, push all target entities toward them
  for (const player of targetPlayers) {
    const playerPos = player.location;

    for (const entity of targetEntities) {
      const entityPos = entity.location;

      // Calculate direction vector toward the player
      const direction = {
        x: playerPos.x - entityPos.x,
        y: playerPos.y - entityPos.y,
        z: playerPos.z - entityPos.z,
      };

      // Normalize the vector (divide by its length)
      const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
      if (length > 0) {
        direction.x = (direction.x / length) * currentConfig.forceMultiplier;
        direction.y = (direction.y / length) * currentConfig.forceMultiplier;
        direction.z = (direction.z / length) * currentConfig.forceMultiplier;
      }

      // Apply impulse to push entity toward the player
      entity.applyImpulse(direction);
    }
  }

  if (currentConfig.debugMessages) {
    console.warn(
      `Path pushing updated: ${targetPlayers.length} target players, ${targetEntities.length} target entities`
    );
  }
}

/**
 * Starts the path pushing system with the given configuration
 * @param config Configuration options for the path pushing system
 */
export function startPathPushing(config: Partial<PathPushingConfig> = {}) {
  // Stop any existing interval
  stopPathPushing();

  // Apply configuration
  currentConfig = {
    ...defaultConfig,
    ...config,
  };

  // Start the interval
  intervalId = system.runInterval(updatePathPushing, currentConfig.updateIntervalTicks);

  if (currentConfig.debugMessages) {
    console.warn("Path pushing system started");
  }
}

/**
 * Stops the path pushing system
 */
export function stopPathPushing() {
  if (intervalId !== undefined) {
    system.clearRun(intervalId);
    intervalId = undefined;

    if (currentConfig.debugMessages) {
      console.warn("Path pushing system stopped");
    }
  }
}
