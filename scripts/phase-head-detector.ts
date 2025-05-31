// filepath: d:\Repositories\Minecraft\phantom-phase\scripts\phase-mode-detector.ts
import { world, system, Player, EquipmentSlot } from "@minecraft/server";
import { enablePhaseMode, disablePhaseMode } from "./phase-mode";
import { startVoidRescueSystem, stopVoidRescueSystem } from "./void-totem";

//phase head tracking initialization
let phantomPhaseActive = false;
let helmetCheckInterval: number | undefined;
const PHASE_HEAD = {
  id: "phantom-phase:phase_head",
  checkInterval: 20,
};

export function startHeadDetection() {
  if (helmetCheckInterval !== undefined) {
    system.clearRun(helmetCheckInterval);
  }

  helmetCheckInterval = system.runInterval(() => {
    checkAllPlayersHeads();
  }, PHASE_HEAD.checkInterval);

  world.sendMessage("§6Head detection activated - wear a o activate phantom phase!");
}

function checkAllPlayersHeads() {
  let anyPlayerWearingHead = false;

  for (const player of world.getAllPlayers()) {
    try {
      if (isPlayerWearingPhaseHead(player)) {
        anyPlayerWearingHead = true;
        break;
      }
    } catch (e) {
      console.warn(`Error checking helmet for player ${player.name}: ${e}`);
    }
  }

  // Toggle phase mode based on whether anyone is wearing the helmet
  if (anyPlayerWearingHead && !phantomPhaseActive) {
    enablePhaseMode();
    startVoidRescueSystem(PHASE_HEAD.id, {
      consumeHelmet: true,
      absorptionAmount: 4,
      absorptionDuration: 30,
      debugMessages: true,
    });
    phantomPhaseActive = true;
    world.sendMessage("§aPhantom Phase activated - special helmet detected!");
  } else if (!anyPlayerWearingHead && phantomPhaseActive) {
    disablePhaseMode();
    stopVoidRescueSystem();
    phantomPhaseActive = false;
    world.sendMessage("§cPhantom Phase deactivated - no special helmets detected");
  }
}

/**
 * Checks if a player is wearing the special phase helmet
 */
function isPlayerWearingPhaseHead(player: Player): boolean {
  try {
    const helmet = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Head);

    if (helmet && helmet.typeId === PHASE_HEAD.id) {
      // You can add additional checks here (e.g., specific enchantments, custom names)
      return true;
    }
  } catch (e) {
    console.warn(`Error checking helmet: ${e}`);
  }

  return false;
}
