import dotenv from 'dotenv';

dotenv.config();

/**
 * Central Feature Flag Configuration
 *
 * Feature flags decouple deployment from feature release.
 * Incomplete features or architectural migrations can be merged into main safely
 * behind an inactive toggle.
 */
export const features = {
  // Flag: ENABLE_ASYNC_NOTIFICATIONS
  // When false: API waits for synchronous email dispatch (legacy behavior)
  // When true: API publishes an event to RabbitMQ and responds immediately
  ENABLE_ASYNC_NOTIFICATIONS: process.env.ENABLE_ASYNC_NOTIFICATIONS === 'true',
};

/**
 * Helper to check whether a specific feature flag is active
 * @param {string} flagName
 * @returns {boolean}
 */
export function isFeatureEnabled(flagName) {
  return Boolean(features[flagName]);
}
