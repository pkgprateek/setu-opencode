/**
 * Enforcement module exports
 */

export {
  isSetuTool,
  isReadOnlyTool,
  isReadOnlyBashCommand,
  isSideEffectTool,
  shouldBlockInPhase0,
  createPhase0BlockMessage,
  type Phase0State,
  type Phase0BlockResult
} from './phase-zero';

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
