/** Every Cal API key starts with this; it is shown to users but not part of the hashed secret. */
export const CAL_API_KEY_PREFIX = "cal_";

/**
 * The secret part of a presented key ("cal_<hex>" → "<hex>"), which is what gets hashed and looked
 * up; keys from before the migration were hashed the same way.
 */
export function apiKeySecret(presented: string): string {
  return presented.startsWith(CAL_API_KEY_PREFIX) ? presented.slice(CAL_API_KEY_PREFIX.length) : presented;
}
