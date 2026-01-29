/**
 * setu_verify tool - Run verification protocol
 */

import { tool } from '@opencode-ai/plugin';
import { getProfileVerificationLevel, type SetuProfile } from '../prompts/profiles';

interface VerificationStep {
  name: string;
  command: string;
  description: string;
  required: boolean;
}

const VERIFICATION_STEPS: VerificationStep[] = [
  {
    name: 'build',
    command: 'npm run build || (npm run build 2>&1 | tail -30)',
    description: 'Check exit code first; if failed, capture last 30 lines',
    required: true
  },
  {
    name: 'test',
    command: 'npm test 2>&1 | grep -A 3 "FAIL\\|Error\\|✗" | head -30',
    description: 'Capture only failures, not full output',
    required: true
  },
  {
    name: 'lint',
    command: 'npm run lint 2>&1 | grep -E "error|warning" | head -20',
    description: 'Capture errors/warnings count',
    required: true
  },
  {
    name: 'typecheck',
    command: 'npm run typecheck || tsc --noEmit 2>&1 | head -30',
    description: 'Type checking if available',
    required: false
  },
  {
    name: 'visual',
    command: '(manual)',
    description: 'Defer to user: "Please verify the UI looks correct"',
    required: false
  }
];

/**
 * Creates the setu_verify tool definition
 */
export function createSetuVerifyTool(
  getProfileState: () => { current: SetuProfile },
  markVerificationComplete: () => void
) {
  return tool({
    description: `Run Setu's verification protocol before completing a task.
Checks build, tests, lint based on current mode.
- Ultrathink: Full verification (all steps)
- Quick: Minimal (build only if risky)
- Expert: User-driven (suggest, don't enforce)
- Collab: Discuss what to verify`,
    
    args: {
      steps: tool.schema.array(tool.schema.string()).optional().describe(
        'Specific steps to run: build, test, lint, typecheck, visual'
      ),
      skipSteps: tool.schema.array(tool.schema.string()).optional().describe(
        'Steps to skip'
      )
    },
    
    async execute(args, _context): Promise<string> {
      const style = getProfileState().current;
      const verificationLevel = getProfileVerificationLevel(style);
      
      let stepsToRun: VerificationStep[];
      
      switch (verificationLevel) {
        case 'full':
          stepsToRun = VERIFICATION_STEPS.filter(s => s.required);
          break;
        case 'minimal':
          stepsToRun = VERIFICATION_STEPS.filter(s => s.name === 'build');
          break;
        case 'user-driven':
        case 'discuss':
          stepsToRun = [];
          break;
      }
      
      // Apply filters
      if (args.steps?.length) {
        stepsToRun = VERIFICATION_STEPS.filter(s => args.steps!.includes(s.name));
      }
      if (args.skipSteps?.length) {
        stepsToRun = stepsToRun.filter(s => !args.skipSteps!.includes(s.name));
      }
      
      markVerificationComplete();
      
      if (stepsToRun.length > 0) {
        const stepsList = stepsToRun
          .map(s => `### ${s.name}\n\`\`\`bash\n${s.command}\n\`\`\`\n${s.description}`)
          .join('\n\n');
        
        return `## Verification Protocol [Style: ${style}]

${stepsList}

**Principle:** Extract only what's needed. One root error often causes many downstream failures — find the root, ignore the noise.`;
      } else {
        let guidance = '';
        if (verificationLevel === 'user-driven') {
          guidance = 'Suggest steps to user, let them decide.';
        } else if (verificationLevel === 'discuss') {
          guidance = 'Discuss with user what verification is needed.';
        }
        
        return `## Verification [Style: ${style}]

Verification level: ${verificationLevel}
${guidance}`;
      }
    }
  });
}
