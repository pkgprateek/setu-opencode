export function formatGuidanceMessage(
  title: string,
  why: string,
  nextStep: string,
  safeAlternative?: string
): string {
  const lines = [
    `[Setu Guidance] ${title}`,
    '',
    `Why: ${why}`,
    `Next: ${nextStep}`,
  ];

  if (safeAlternative) {
    lines.push(`Safe alternative: ${safeAlternative}`);
  }

  return lines.join('\n');
}
