// filepath: d:\Repositories\Minecraft\phantom-phase\scripts\phase-mode-end.ts
import { world, system, Player, Vector3, ExplosionOptions } from "@minecraft/server";
import { MinecraftEffectTypes } from "@minecraft/vanilla-data";

// Configuration interface for phase-end effects
interface PhaseEndConfig {
  explosionPower: number; // Power of the explosion (1.0 = TNT)
  explosionBreaksBlocks: boolean; // Whether the explosion breaks blocks
  levitationDuration: number; // Duration of levitation effect in seconds
  levitationAmplifier: number; // Amplifier for levitation effect (height/speed)
  resistanceDuration: number; // Duration of resistance effect in seconds
  resistanceAmplifier: number; // Amplifier for resistance effect (damage reduction)
  fireResistanceDuration: number; // Duration of fire resistance in seconds
  debugMessages: boolean; // Whether to show debug messages
}

// Default configuration
const DEFAULT_CONFIG: PhaseEndConfig = {
  explosionPower: 1.0, // Default TNT-sized explosion
  explosionBreaksBlocks: false, // Don't break blocks by default
  levitationDuration: 3, // 3 seconds of levitation
  levitationAmplifier: 2, // Level 3 (moderate height)
  resistanceDuration: 10, // 10 seconds of resistance
  resistanceAmplifier: 4, // Level 5 (max resistance)
  fireResistanceDuration: 10, // 10 seconds of fire resistance
  debugMessages: true,
};

// Active configuration
let config: PhaseEndConfig = { ...DEFAULT_CONFIG };

// Debug state
let debugMessages = true;

/**
 * Apply phase-end effects to a player when exiting phase mode
 * @param player The player to apply effects to
 */
export function applyPhaseEndEffects(player: Player): void {
  try {
    // Delay effects slightly to ensure they apply after game mode changes
    system.runTimeout(() => {
      try {
        // Apply levitation effect
        player.addEffect(MinecraftEffectTypes.Levitation, config.levitationDuration * 20, {
          amplifier: config.levitationAmplifier,
          showParticles: true,
        });

        // Apply resistance effect (max level)
        player.addEffect(MinecraftEffectTypes.Resistance, config.resistanceDuration * 20, {
          amplifier: config.resistanceAmplifier,
          showParticles: true,
        });

        // Apply fire resistance effect
        player.addEffect(MinecraftEffectTypes.FireResistance, config.fireResistanceDuration * 20, {
          amplifier: 0,
          showParticles: true,
        });

        // Create explosion at player's location
        createPhaseExplosion(player);

        // Play effects
        playPhaseEndParticles(player);
        playPhaseEndSound(player);

        if (config.debugMessages) {
          world.sendMessage(`§d${player.name} exited phase mode with special effects!`);
        }
      } catch (effectError) {
        if (config.debugMessages) {
          world.sendMessage(`§cError applying phase end effects: ${effectError}`);
        }
      }
    }, 5); // Small delay to ensure effects apply after mode changes
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`§cFailed to apply phase-end effects: ${e}`);
    }
  }
}

/**
 * Create an explosion at the player's location
 * @param player The player at whose location to create explosion
 */
function createPhaseExplosion(player: Player): void {
  try {
    // Set up explosion options
    const options: ExplosionOptions = {
      source: player,
      breaksBlocks: config.explosionBreaksBlocks,
      causesFire: false, // Never cause fire
    };

    // Create explosion at player's location
    player.dimension.createExplosion(player.location, config.explosionPower, options);
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`§cFailed to create phase explosion: ${e}`);
    }
  }
}

/**
 * Play particles at phase end
 * @param player Player to show particles for
 */
function playPhaseEndParticles(player: Player): void {
  try {
    // Run particle commands
    player.dimension.runCommand(
      `particle minecraft:endrod ${player.location.x} ${player.location.y + 1} ${player.location.z} 0.5 0.5 0.5 0.1 50`
    );
    player.dimension.runCommand(
      `particle minecraft:portal ${player.location.x} ${player.location.y + 1} ${player.location.z} 0.5 0.5 0.5 0.1 100`
    );
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`§cFailed to create phase end particles: ${e}`);
    }
  }
}

/**
 * Play sound effects at phase end
 * @param player Player to play sounds for
 */
function playPhaseEndSound(player: Player): void {
  try {
    // Play teleport and thunder sounds for dramatic effect
    player.dimension.runCommand(
      `playsound mob.endermen.portal player @a ${player.location.x} ${player.location.y} ${player.location.z} 1.0 0.7`
    );
    player.dimension.runCommand(
      `playsound random.explode player @a ${player.location.x} ${player.location.y} ${player.location.z} 0.7 0.8`
    );
  } catch (e) {
    if (config.debugMessages) {
      world.sendMessage(`§cFailed to play phase end sounds: ${e}`);
    }
  }
}

/**
 * Set the debug mode for the phase end effects system
 * @param enabled Whether to enable debug messages
 */
export function setInvulnerabilityDebug(enabled: boolean): void {
  debugMessages = enabled;
  config.debugMessages = enabled;
}

/**
 * Update the configuration for phase end effects
 * @param newConfig New configuration to apply
 */
export function updatePhaseEndConfig(newConfig: Partial<PhaseEndConfig>): void {
  // Update configuration with new values
  config = {
    ...config,
    ...newConfig,
  };

  if (config.debugMessages) {
    world.sendMessage("§aPhase end effects configuration updated");
  }
}
