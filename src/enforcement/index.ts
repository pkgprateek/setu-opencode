/**
 * Enforcement module exports
 */

export {
  isSetuTool,
  isReadOnlyTool,
  isReadOnlyBashCommand,
  isSideEffectTool,
  shouldBlockDuringHydration,
  createHydrationBlockMessage,
  type HydrationState,
  type HydrationBlockResult
} from './hydration';

// Gearbox (v1.1.0)
export {
  determineGear,
  shouldBlock,
  createGearBlockMessage,
  type Gear,
  type GearState,
  type GearBlockResult
} from './gears';

// Attempt tracking with gear shifting (v1.1.0)
export {
  createEnhancedAttemptTracker,
  type AttemptState,
  type AttemptTracker,
  type AttemptTrackerConfig
} from './attempts';
