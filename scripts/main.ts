import { world, system } from "@minecraft/server";
import { updatePhaseConfig } from "./phase-mode";
import { startHeadDetection } from "./phase-head-detector";

let ticksSinceLoad = 0;

function mainTick() {
  ticksSinceLoad++;

  if (ticksSinceLoad === 60) {
    world.sendMessage("§6Phantom Phase system initialized...");

    updatePhaseConfig({
      speedThresholdBps: 25.0,
      exitSpeedThresholdBps: 7.0,
      inactiveFramesThreshold: 20,
      debugMessages: true,
      preserveInventory: true,
      phaseBlockCheckDistance: 10,
      alwaysUseSpectator: false,
      spectatorBlockCheckInterval: 5,
    });

    startHeadDetection();
  }
  system.run(mainTick);
}

system.run(mainTick);
