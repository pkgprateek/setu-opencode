/**
 * Type Guards for Runtime Safety
 * 
 * These guards provide type-safe runtime checks, eliminating
 * unsafe casts like `value as string` that can hide bugs.
 * 
 * Design principle: Fail gracefully with explicit handling,
 * never silently assume a type is correct.
 */

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if a value is a non-null object (not array)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

/**
 * Safely extract a string property from an object
 * Returns undefined if the property doesn't exist or isn't a string
 */
export function getStringProp(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return isString(value) ? value : undefined;
}

/**
 * Safely extract a number property from an object
 * Returns undefined if the property doesn't exist or isn't a number
 */
export function getNumberProp(obj: unknown, key: string): number | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return isNumber(value) ? value : undefined;
}

/**
 * Safely extract a boolean property from an object
 * Returns undefined if the property doesn't exist or isn't a boolean
 */
export function getBooleanProp(obj: unknown, key: string): boolean | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return isBoolean(value) ? value : undefined;
}
