export function formatGuidanceMessage(
  why: string,
  nextStep: string,
  safeAlternative?: string
): string {
  return `Wait: ${why}. ${nextStep}${safeAlternative ? ` ${safeAlternative}` : ''}`;
}
