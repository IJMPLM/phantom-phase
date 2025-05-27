import { world, system } from "@minecraft/server";
function updateGameMode() {
    return __awaiter(this, void 0, void 0, function* () {
        for (const player of world.getPlayers()) {
            const effect = player.getEffect("regeneration"); // Check if player has healing effect
            if (effect) {
                yield world.getDimension("overworld").runCommandAsync(`gamemode spectator ${player.name}`); // Switch to Spectator Mode
                yield world.getDimension("overworld").runCommandAsync(`effect ${player.name} speed 10 5 true`); // Apply speed boost
            }
            else {
                yield world.getDimension("overworld").runCommandAsync(`gamemode survival ${player.name}`); // Switch back to Survival Mode
                yield world.getDimension("overworld").runCommandAsync(`effect ${player.name} clear speed`); // Remove speed boost
            }
        }
        system.run(updateGameMode); // Continuously check player state
    });
}
system.run(updateGameMode);
//# sourceMappingURL=rex.js.map