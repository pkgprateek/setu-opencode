/**
 * setu_verify tool - Run verification protocol
 * 
 * Detects project build tool and generates appropriate commands.
 * Supports: npm, yarn, pnpm, bun, cargo, go, python (uv/pip)
 */

import { tool } from '@opencode-ai/plugin';
import { getProfileVerificationLevel, type SetuProfile } from '../prompts/profiles';
import { detectProjectInfo } from '../context/storage';

/**
 * Build commands per tool/runtime
 * 
 * Each entry provides the command templates for build, test, lint, typecheck.
 * Empty string means the step is not applicable for that tool.
 */
const BUILD_COMMANDS: Record<string, {
  build: string;
  test: string;
  lint: string;
  typecheck: string;
}> = {
  // Node.js package managers
  npm: {
    build: 'npm run build',
    test: 'npm test',
    lint: 'npm run lint',
    typecheck: 'npm run typecheck || tsc --noEmit'
  },
  yarn: {
    build: 'yarn build',
    test: 'yarn test',
    lint: 'yarn lint',
    typecheck: 'yarn typecheck || tsc --noEmit'
  },
  pnpm: {
    build: 'pnpm build',
    test: 'pnpm test',
    lint: 'pnpm lint',
    typecheck: 'pnpm typecheck || tsc --noEmit'
  },
  bun: {
    build: 'bun run build',
    test: 'bun test',
    lint: 'bun run lint',
    typecheck: 'bun run typecheck || tsc --noEmit'
  },
  
  // Non-JS ecosystems
  cargo: {
    build: 'cargo build',
    test: 'cargo test',
    lint: 'cargo clippy -- -D warnings',
    typecheck: '' // Rust's compiler handles types
  },
  go: {
    build: 'go build ./...',
    test: 'go test ./...',
    lint: 'golangci-lint run',
    typecheck: '' // Go's compiler handles types
  },
  uv: {
    build: '', // Python typically doesn't have a build step
    test: 'uv run pytest',
    lint: 'uv run ruff check .',
    typecheck: 'uv run mypy .'
  },
  pip: {
    build: '',
    test: 'python -m pytest',
    lint: 'python -m ruff check . || python -m flake8',
    typecheck: 'python -m mypy .'
  }
};

// Default fallback
const DEFAULT_BUILD_TOOL = 'npm';

interface VerificationStep {
  name: string;
  command: string;
  description: string;
  required: boolean;
}

/**
 * Generate verification steps for the detected build tool
 */
function generateVerificationSteps(buildTool: string): VerificationStep[] {
  const commands = BUILD_COMMANDS[buildTool] || BUILD_COMMANDS[DEFAULT_BUILD_TOOL];
  
  const steps: VerificationStep[] = [];
  
  if (commands.build) {
    steps.push({
      name: 'build',
      command: `${commands.build} || (${commands.build} 2>&1 | tail -30)`,
      description: 'Check exit code first; if failed, capture last 30 lines',
      required: true
    });
  }
  
  if (commands.test) {
    steps.push({
      name: 'test',
      command: `${commands.test} 2>&1 | grep -A 3 "FAIL\\|Error\\|✗\\|FAILED" | head -30`,
      description: 'Capture only failures, not full output',
      required: true
    });
  }
  
  if (commands.lint) {
    steps.push({
      name: 'lint',
      command: `${commands.lint} 2>&1 | grep -E "error|warning" | head -20`,
      description: 'Capture errors/warnings count',
      required: true
    });
  }
  
  if (commands.typecheck) {
    steps.push({
      name: 'typecheck',
      command: `${commands.typecheck} 2>&1 | head -30`,
      description: 'Type checking if available',
      required: false
    });
  }
  
  // Visual check is always available (deferred to user)
  steps.push({
    name: 'visual',
    command: '(manual)',
    description: 'Defer to user: "Please verify the UI looks correct"',
    required: false
  });
  
  return steps;
}

/**
 * Creates the setu_verify tool definition
 * 
 * @param getProfileState - Accessor for current profile state
 * @param markVerificationComplete - Callback to mark verification complete
 * @param getProjectDir - Accessor for project directory (for build tool detection)
 */
export function createSetuVerifyTool(
  getProfileState: () => { current: SetuProfile },
  markVerificationComplete: () => void,
  getProjectDir?: () => string
): ReturnType<typeof tool> {
  return tool({
    description: `Run Setu's verification protocol before completing a task.
Checks build, tests, lint based on current mode.
Automatically detects project build tool (npm/yarn/pnpm/bun/cargo/go).
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
      
      // Detect project build tool
      const projectDir = getProjectDir ? getProjectDir() : process.cwd();
      const projectInfo = detectProjectInfo(projectDir);
      const buildTool = projectInfo.buildTool || DEFAULT_BUILD_TOOL;
      
      // Generate steps for detected build tool
      const allSteps = generateVerificationSteps(buildTool);
      
      let stepsToRun: VerificationStep[];
      
      switch (verificationLevel) {
        case 'full':
          stepsToRun = allSteps.filter(s => s.required);
          break;
        case 'minimal':
          stepsToRun = allSteps.filter(s => s.name === 'build');
          break;
        case 'user-driven':
        case 'discuss':
          stepsToRun = [];
          break;
      }
      
      // Apply filters
      if (args.steps?.length) {
        stepsToRun = allSteps.filter(s => args.steps!.includes(s.name));
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

**Detected:** ${projectInfo.type || 'unknown'} project using \`${buildTool}\`

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

**Detected:** ${projectInfo.type || 'unknown'} project using \`${buildTool}\`

Verification level: ${verificationLevel}
${guidance}`;
      }
    }
  });
}
