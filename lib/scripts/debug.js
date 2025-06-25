import { ActionFormData } from "@minecraft/server-ui";
import { world, system } from "@minecraft/server";
export function showCustomMenu(player) {
    const form = new ActionFormData()
        .title("⚙ Manual Script Runner")
        .body("Choose a script to run")
        .button("Spawn Phase")
        .button("Check Phantom Spawn Condition")
        .button("World Message test");
    form.show(player).then((response) => {
        if (response.canceled)
            return;
        switch (response.selection) {
            case 0:
                system.runInterval(() => {
                    const spawnChance = 0.25 * (5 - 3);
                    const roll = Math.random();
                    const spawnSuccessful = roll <= spawnChance;
                    if (spawnSuccessful) {
                        const phasePos = {
                            x: player.location.x,
                            y: player.location.y + 10, // 10 blocks above player
                            z: player.location.z,
                        };
                        player.dimension.spawnEntity("phantom-phase:phase", phasePos);
                        player.sendMessage("§c⚡ Phase entity spawned 100 blocks above due to blocked phantom conditions!");
                    }
                    else {
                        player.sendMessage(`§c⚡ Phase roll failed, roll = ${roll}, chance = ${spawnChance} `);
                    }
                }, 40);
                const spawnChance = 0.25 * (5 - 3);
                const roll = Math.random();
                const spawnSuccessful = roll <= spawnChance;
                if (spawnSuccessful) {
                    const phasePos = {
                        x: player.location.x,
                        y: player.location.y + 10, // 10 blocks above player
                        z: player.location.z,
                    };
                    player.dimension.spawnEntity("phantom-phase:phase", phasePos);
                    player.sendMessage("§c⚡ Phase entity spawned 100 blocks above due to blocked phantom conditions!");
                }
                else {
                    player.sendMessage(`§c⚡ Phase roll failed, roll = ${roll}, chance = ${spawnChance} `);
                }
                break;
            case 1:
                function hasSkyAccess(player) {
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
                    }
                    catch (error) {
                        // If there's an error, default to having sky access
                        return true;
                    }
                }
                const aboveMinY = player.location.y >= 64;
                const skyAccessible = hasSkyAccess(player);
                if (aboveMinY) {
                    player.sendMessage("§7Phantom spawns above MinY");
                }
                else {
                    player.sendMessage("§c Phantom does not spawn, below MinY");
                }
                if (skyAccessible) {
                    player.sendMessage("§7Phantom spawns has sky access");
                }
                else {
                    player.sendMessage("§c Phantom does not spawn, no sky access");
                }
                break;
            case 2:
                const day = world.getDay();
                world.sendMessage(`day: ${day}`);
        }
    });
}
//# sourceMappingURL=debug.js.map