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

export function formatPolicyDecisionSummary(
  score: number,
  action: 'execute' | 'ask' | 'block',
  reason: string[]
): string {
  const decision = action === 'execute' ? 'execute now' : action === 'ask' ? 'ask first' : 'block';
  return `Policy decision: ${decision} (score=${score.toFixed(2)}). ${reason.join('; ')}`;
}
