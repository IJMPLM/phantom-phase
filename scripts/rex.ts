import { world, system, GameMode } from "@minecraft/server";

async function updateGameMode() {
  for (const player of world.getPlayers()) {
    const effect = player.getEffect("regeneration"); // Check if player has healing effect

    if (effect) {
      await world.getDimension("overworld").runCommandAsync(`gamemode spectator ${player.name}`); // Switch to Spectator Mode
      await world.getDimension("overworld").runCommandAsync(`effect ${player.name} speed 10 5 true`); // Apply speed boost
    } else {
      await world.getDimension("overworld").runCommandAsync(`gamemode survival ${player.name}`); // Switch back to Survival Mode
      await world.getDimension("overworld").runCommandAsync(`effect ${player.name} clear speed`); // Remove speed boost
    }
  }

  system.run(updateGameMode); // Continuously check player state
}

system.run(updateGameMode);
