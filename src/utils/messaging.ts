export function formatGuidanceMessage(
  _title: string,
  why: string,
  nextStep: string,
  safeAlternative?: string
): string {
  return `Wait: ${why} ${nextStep}${safeAlternative ? ` ${safeAlternative}` : ''}`;
}
