import { world, system, Player, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { MinecraftEffectTypes, MinecraftDimensionTypes } from "@minecraft/vanilla-data";
// Default configuration
const DEFAULT_CONFIG = {
    enabled: true,
    consumeHelmet: true, // Consume the phase head item when rescue happens
    absorptionAmount: 4, // Grant 4 levels of absorption (8 hearts)
    absorptionDuration: 30, // Absorption lasts 30 seconds
    rescueCooldown: 60, // 1 minute cooldown between rescues
    totemEffectDuration: 5, // Totem effects last 5 seconds
    debugMessages: false, // Don't show debug messages by default
};
// Active configuration
let config = Object.assign({}, DEFAULT_CONFIG);
// Store player rescue cooldowns
const playerRescueCooldowns = new Map();
// Store the phase head ID
let phaseHeadId = "";
/**
 * Checks if a player is wearing the phase head
 * @param player The player to check
 */
function isWearingPhaseHead(player) {
    var _a;
    try {
        const helmet = (_a = player.getComponent("minecraft:equippable")) === null || _a === void 0 ? void 0 : _a.getEquipment(EquipmentSlot.Head);
        return (helmet === null || helmet === void 0 ? void 0 : helmet.typeId) === phaseHeadId;
    }
    catch (e) {
        return false;
    }
}
/**
 * Consumes the phase head by replacing it with air
 * @param player The player whose phase head should be consumed
 */
function consumePhaseHead(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        if (equippable) {
            // Remove the helmet by replacing with air
            equippable.setEquipment(EquipmentSlot.Head, undefined);
            return true;
        }
        return false;
    }
    catch (e) {
        console.warn(`Error consuming phase head: ${e}`);
        return false;
    }
}
/**
 * Apply totem effects to a player (similar to Totem of Undying)
 * @param player The player to apply effects to
 */
function applyTotemEffects(player) {
    try {
        // Apply regeneration effect
        player.addEffect(MinecraftEffectTypes.Regeneration, config.totemEffectDuration * 20, {
            amplifier: 1,
        });
        // Apply fire resistance (often granted by totems)
        player.addEffect(MinecraftEffectTypes.FireResistance, config.totemEffectDuration * 20, {
            amplifier: 0,
        });
        // Apply absorption hearts
        player.addEffect(MinecraftEffectTypes.Absorption, config.absorptionDuration * 20, {
            amplifier: config.absorptionAmount - 1,
        });
        // Play totem particles at player location
        player.runCommand(`particle minecraft:totem_particle ~~~`);
        // Play totem sound
        player.dimension.runCommand(`playsound item.totem.use player @a ${player.location.x} ${player.location.y} ${player.location.z} 1.0 1.0`);
    }
    catch (e) {
        console.warn(`Error applying totem effects: ${e}`);
    }
}
/**
 * Teleport player to their spawn point
 * @param player The player to teleport
 * @returns True if successfully teleported, false otherwise
 */
function teleportToSpawnPoint(player) {
    try {
        // Try to find the player's spawn point
        const spawnPoint = player.getSpawnPoint();
        if (!spawnPoint) {
            // If no specific spawn is set, use world spawn in overworld
            try {
                const overworld = world.getDimension(MinecraftDimensionTypes.Overworld);
                // Get the default world spawn - for simplicity using overworld's (0,70,0)
                // This is a simplification - in a real scenario you might want to use a different approach
                const worldSpawn = { x: 0, y: 70, z: 0 };
                player.teleport(worldSpawn, {
                    dimension: overworld,
                    keepVelocity: false,
                });
                return true;
            }
            catch (e) {
                if (config.debugMessages) {
                    world.sendMessage(`§c${player.name} has no spawn point set, cannot rescue from void!`);
                }
                return false;
            }
        }
        // Get the spawn dimension
        const spawnDimension = world.getDimension("overworld");
        // Teleport player to their spawn point
        const spawnLocation = {
            x: spawnPoint.x + 0.5,
            y: spawnPoint.y + 0.5,
            z: spawnPoint.z + 0.5,
        };
        player.teleport(spawnLocation, {
            dimension: spawnDimension,
            keepVelocity: false,
            rotation: { x: player.getRotation().x, y: player.getRotation().y },
        });
        return true;
    }
    catch (e) {
        console.warn(`Error teleporting player to spawn: ${e}`);
        return false;
    }
}
/**
 * Handle entity damage events to detect void damage and rescue players
 * @param event The entity damage event
 */
function handleEntityDamage(event) {
    var _a;
    // Skip if disabled
    if (!config.enabled)
        return;
    try {
        // Check if damage is to a player
        if (!((_a = event.hurtEntity) === null || _a === void 0 ? void 0 : _a.id) || !(event.hurtEntity instanceof Player)) {
            return;
        }
        const player = event.hurtEntity;
        // Get damage cause
        const damageSource = event.damageSource;
        // Check if damage is from void
        if (damageSource.cause !== EntityDamageCause.void) {
            return;
        }
        // Check if player is on cooldown
        const currentTick = system.currentTick;
        if (playerRescueCooldowns.has(player.id)) {
            const cooldownEndTick = playerRescueCooldowns.get(player.id);
            if (currentTick < cooldownEndTick) {
                if (config.debugMessages) {
                    player.sendMessage("§cVoid rescue on cooldown!");
                }
                return;
            }
            // Cooldown expired, remove from map
            playerRescueCooldowns.delete(player.id);
        }
        // Check if player is wearing phase head
        if (isWearingPhaseHead(player)) {
            // Cancel the void damage
            event.cancel = true;
            // Attempt to teleport to spawn
            const teleported = teleportToSpawnPoint(player);
            if (teleported) {
                // Successfully rescued
                world.sendMessage(`§b${player.name} was rescued from the void by their Phantom Phase helmet!`);
                // Consume the phase head if configured
                if (config.consumeHelmet) {
                    consumePhaseHead(player);
                    player.sendMessage(`§6Your Phantom Phase helmet was consumed during the rescue!`);
                }
                // Apply totem effects
                applyTotemEffects(player);
                // Set cooldown
                playerRescueCooldowns.set(player.id, currentTick + config.rescueCooldown * 20);
            }
        }
        else if (config.debugMessages) {
            // Player doesn't have phase head but is in void
            player.sendMessage(`§cYou're falling into the void without a phase helmet!`);
        }
    }
    catch (e) {
        console.warn(`Error handling entity damage: ${e}`);
    }
}
/**
 * Start monitoring players for void damage
 */
export function startVoidRescueSystem(headId, customConfig) {
    // Store the phase head ID
    phaseHeadId = headId;
    // Apply custom configuration if provided
    if (customConfig) {
        config = Object.assign(Object.assign({}, config), customConfig);
    }
    // Register for damage events to detect void damage
    world.afterEvents.entityHurt.subscribe(handleEntityDamage);
    if (config.debugMessages) {
        world.sendMessage("§aVoid rescue system started - your Phase Helmet will save you from the void");
    }
}
/**
 * Stop the void rescue system
 */
export function stopVoidRescueSystem() {
    // Clear cooldown data
    playerRescueCooldowns.clear();
    if (config.debugMessages) {
        world.sendMessage("§cVoid rescue system stopped");
    }
}
/**
 * Update the void rescue configuration
 */
export function updateVoidRescueConfig(newConfig) {
    config = Object.assign(Object.assign({}, config), newConfig);
}
//# sourceMappingURL=void-totem.js.map