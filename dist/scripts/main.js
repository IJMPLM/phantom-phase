// scripts/main.ts
import { world as world2, system, BlockPermutation as BlockPermutation2 } from "@minecraft/server";

// scripts/Utilities.ts
import { world } from "@minecraft/server";
var Utilities = class {
  static fillBlock(blockPerm, xFrom, yFrom, zFrom, xTo, yTo, zTo) {
    const overworld = world.getDimension("overworld");
    for (let i = xFrom; i <= xTo; i++) {
      for (let j = yFrom; j <= yTo; j++) {
        for (let k = zFrom; k <= zTo; k++) {
          overworld.getBlock({ x: i, y: j, z: k })?.setPermutation(blockPerm);
        }
      }
    }
  }
  static fourWalls(perm, xFrom, yFrom, zFrom, xTo, yTo, zTo) {
    const overworld = world.getDimension("overworld");
    const xFromP = Math.min(xFrom, xTo);
    const xToP = Math.max(xFrom, xTo);
    const yFromP = Math.min(yFrom, yTo);
    const yToP = Math.max(yFrom, yTo);
    const zFromP = Math.min(zFrom, zTo);
    const zToP = Math.max(zFrom, zTo);
    for (let i = xFromP; i <= xToP; i++) {
      for (let k = yFromP; k <= yToP; k++) {
        overworld.getBlock({ x: i, y: k, z: zFromP })?.setPermutation(perm);
        overworld.getBlock({ x: i, y: k, z: zToP })?.setPermutation(perm);
      }
    }
    for (let j = zFromP + 1; j < zToP; j++) {
      for (let k = yFromP; k <= yToP; k++) {
        overworld.getBlock({ x: xFromP, y: k, z: j })?.setPermutation(perm);
        overworld.getBlock({ x: xToP, y: k, z: j })?.setPermutation(perm);
      }
    }
  }
};

// scripts/main.ts
var ticksSinceLoad = 0;
var ZooMobList = ["aop_mobs:biceson", "aop_mobs:frost_moose", "aop_mobs:sheepomelon"];
function mainTick() {
  ticksSinceLoad++;
  if (ticksSinceLoad === 100) {
    world2.sendMessage("Welcome to the wacky zoo!");
    initialize();
  }
  system.run(mainTick);
}
function getTriggerLoc() {
  const spawnLoc = world2.getDefaultSpawnLocation();
  const x = spawnLoc.x - 5;
  const z = spawnLoc.z - 5;
  const y = findTopmostBlockUsingPlayer(x, z);
  return { x, y, z };
}
function getZooLoc() {
  const spawnLoc = world2.getDefaultSpawnLocation();
  const x = spawnLoc.x - 25;
  const z = spawnLoc.z - 25;
  const y = findTopmostBlockUsingPlayer(x, z);
  return { x, y, z };
}
function findTopmostBlockUsingPlayer(x, z) {
  const ow = world2.getDimension("overworld");
  let y = -60;
  const players = world2.getPlayers();
  if (players.length > 0) {
    y = Math.max(players[0].location.y - 8, -62);
    let block = ow.getBlock({ x, y, z });
    while (block && !block.permutation.matches("minecraft:air")) {
      y++;
      block = ow.getBlock({ x, y, z });
    }
  }
  return y;
}
function initialize() {
  const overworld = world2.getDimension("overworld");
  const triggerLoc = getTriggerLoc();
  const cobblestone = overworld.getBlock(triggerLoc);
  const button = overworld.getBlock({ x: triggerLoc.x, y: triggerLoc.y + 1, z: triggerLoc.z });
  if (cobblestone === void 0 || button === void 0) {
    console.warn("Could not load the position to place our switch.");
    return -1;
  }
  world2.sendMessage("Adding a button at x: " + triggerLoc.x + " y:" + triggerLoc.y + " z: " + triggerLoc.z);
  cobblestone.setPermutation(BlockPermutation2.resolve("cobblestone"));
  button.setPermutation(BlockPermutation2.resolve(
    "acacia_button",
    { facing_direction: 1 }
    /* up */
  ));
  world2.afterEvents.buttonPush.subscribe(spawnZoo);
}
function spawnZoo() {
  const zooLoc = getZooLoc();
  const overworld = world2.getDimension("overworld");
  Utilities.fourWalls(
    BlockPermutation2.resolve("minecraft:glass"),
    zooLoc.x - 20,
    zooLoc.y + 20,
    zooLoc.z - 20,
    zooLoc.x,
    zooLoc.y,
    zooLoc.z
  );
  let mobLoc = { x: zooLoc.x - 2, y: zooLoc.y, z: zooLoc.z - 2 };
  for (const mob of ZooMobList) {
    world2.sendMessage("Spawning mob: " + mob);
    overworld.spawnEntity(mob, mobLoc);
    mobLoc = { x: mobLoc.x - 2, y: mobLoc.y + 1, z: mobLoc.z - 2 };
  }
}
system.run(mainTick);

//# sourceMappingURL=../debug/main.js.map
