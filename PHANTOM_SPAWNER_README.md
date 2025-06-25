# Phantom Phase - Optimized Sleep Tracking System

This component tracks sleep skipping behavior and spawns phase entities when phantom spawning conditions are blocked. The system uses optimized day/night checks that only run once per cycle for better performance.

## Testing Commands

### Setting up sleep tracking

```
# To simulate a player who didn't sleep (will increment daysSinceLastRest)
# No tag needed - the system automatically tracks all players

# To simulate a player who slept (will reset daysSinceLastRest to 0)
/tag @s add slept_recently
```

The system automatically tracks sleep behavior without requiring manual tags.

### Testing the sky access mechanism

Build a solid block above your head to block sky access. The system will detect this and attempt phase spawning if conditions are met.

For debugging, you can use these commands:

```
# Set time to test day/night transitions
/time set day
/time set night

# Check if you're in testing mode (should show in the startup message)
```

### Force day/night cycle to advance

```
/time add 24000
```

Adds a full day to the world time.

## System mechanics

1. **Sleep tracking**:
   - Automatically tracks all players
   - Increments `daysSinceLastRest` each day if player didn't sleep
   - Resets counter to 0 if player slept (has `slept_recently` tag)

2. **Optimized checking**:
   - **Day check**: Runs once per day during daytime
   - **Night check**: Runs once per night for optimization
   - **Phase spawn rolls**: Every 2000 ticks (100 seconds) during night

3. **Phase entity spawning**:
   - Only triggers when `daysSinceLastRest >= 4`
   - Spawn chance: 25% × (daysSinceLastRest - 3)
   - Max spawns per night: daysSinceLastRest - 3
   - Only spawns when phantom conditions are blocked (no sky access)
   - Spawns 100 blocks above player
   - Player gets `phase_target` tag for path-pushing system

## Debug output

The system provides several debug messages:

- Daily sleep tracking updates
- Night optimization status
- Phase spawn attempts with success/fail roll
- Condition check details (above minimum Y, sky access)
- Notification when phase entities are spawned

## Configuration

The system can be configured by passing a configuration object to the `startPhantomSpawner()` function:

```typescript
startPhantomSpawner({
  debugMode: true, // Show debug messages
  minYLevel: 64, // Minimum Y level for spawn checks
  dayCheckTicks: 1200, // Day check interval (1 minute)
  nightCheckTicks: 1200, // Night check interval (1 minute)
  phaseSpawnRollTicks: 2000, // Phase spawn roll interval (100 seconds)
  nightStartTicks: 13000, // Night time start in ticks
  nightEndTicks: 23000, // Night time end in ticks
  testingMode: true, // Bypass night time requirements for testing
});
```
