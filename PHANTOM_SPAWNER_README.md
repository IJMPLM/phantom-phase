# Phantom Phase - Phantom Spawner System

This component monitors phantom spawning conditions and creates a simulation of what happens when phantoms should spawn but cannot due to sky access being blocked. After 3 failed phantom spawn attempts, a creeper will be spawned directly above the player at Y=256.

## Testing Commands

Use these commands to test the phantom spawner system:

### Setting up insomnia

```
/tag @s add insomnia
```

The player tag "insomnia" is being used as a proxy for the insomnia component in Bedrock Edition. To remove it:

```
/tag @s remove insomnia
```

### Setting the time to night

```
/time set night
```

### Preventing sky access

Build a solid block ceiling above the player to prevent sky access. Make sure you're at Y>=64.

### Force day/night cycle to advance

```
/time add 24000
```

Adds a full day to the world time.

## Debug output

The system provides several debug messages:

- Insomnia days counter in the action bar
- Phantom spawn attempts with success/fail roll
- Condition check details (above sea level, sky access)
- Counter for blocked phantom spawns
- Notification when a creeper is spawned due to blocked phantom spawns

## System mechanics

1. **Phantom spawn conditions**:

   - Player must have insomnia (3+ days without sleep)
   - Player must be above sea level (Y >= 64)
   - Player must have sky access
   - Must be night time (13000-23000 ticks)
   - Random check every 1-2 minutes

2. **Spawn chance calculation**:

   - Day 3: 0% (no spawns yet)
   - Day 4: 25% chance
   - Day 5: 37.5% chance
   - Day 6+: 50% chance

3. **Failed spawn counter**:
   - Increments when a phantom would have spawned but couldn't due to lack of sky access
   - Resets when player sleeps or when a phantom successfully spawns
   - When counter reaches 3, a creeper spawns at Y=256 directly above the player

## Configuration

The system can be configured by passing a configuration object to the `startPhantomSpawner()` function:

```typescript
startPhantomSpawner({
  debugMode: true, // Show debug messages
  minDaysWithoutSleep: 3, // Minimum days without sleep for phantoms to spawn
  minYLevel: 64, // Minimum Y level for phantoms to spawn
  blockedSpawnsBeforeCreeper: 3, // Number of blocked spawns before creeper appears
  checkIntervalTicks: 1200, // Check interval (1 minute = 1200 ticks)
  nightStartTicks: 13000, // Night time start in ticks
  nightEndTicks: 23000, // Night time end in ticks
});
```
