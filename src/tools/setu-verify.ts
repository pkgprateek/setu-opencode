/**
 * setu_verify tool - Run verification protocol
 * 
 * Detects project build tool and generates appropriate commands.
 * Supports: npm, yarn, pnpm, bun, cargo, go, python (uv/pip)
 */

import { tool } from '@opencode-ai/plugin';
import { getStyleVerificationLevel, type SetuStyle } from '../prompts/styles';
import { detectProjectInfo } from '../context/storage';
import { logVerification } from '../context/storage';
import { writeStepResult, sanitizeYamlString } from '../context/results';
import { advanceStep, loadActiveTask } from '../context/active';

/**
 * Helper to extract error message consistently
 * Prevents repetitive error instanceof Error checks
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
    lint: 'if python -m ruff --version >/dev/null 2>&1; then python -m ruff check .; else python -m flake8; fi',
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
      command: `bash -lc "set -o pipefail; ${commands.build} 2>&1 | tee /tmp/build.log" || tail -30 /tmp/build.log`,
      description: 'Capture output on first run; show last 30 lines on failure',
      required: true
    });
  }
  
  if (commands.test) {
    steps.push({
      name: 'test',
      command: `bash -lc 'set -o pipefail; ${commands.test} 2>&1 | { grep -A 3 "FAIL\\|Error\\|✗\\|FAILED" || true; } | head -30'`,
      description: 'Capture only failures, not full output',
      required: true
    });
  }
  
  if (commands.lint) {
    steps.push({
      name: 'lint',
      command: `bash -lc 'set -o pipefail; ${commands.lint} 2>&1 | { grep -E "error|warning" || true; } | head -20'`,
      description: 'Capture errors/warnings count',
      required: true
    });
  }
  
  if (commands.typecheck) {
    steps.push({
      name: 'typecheck',
      command: `bash -lc 'set -o pipefail; ${commands.typecheck} 2>&1 | head -30'`,
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
 * @param getStyleState - Accessor for current style state
 * @param markVerificationComplete - Callback to mark verification complete
 * @param getProjectDir - Accessor for project directory (for build tool detection)
 */
export function createSetuVerifyTool(
  getStyleState: () => { current: SetuStyle },
  markVerificationComplete: () => void,
  getProjectDir?: () => string
): ReturnType<typeof tool> {
  return tool({
    description: `Run Setu's verification protocol before completing a task.
Checks build, tests, lint based on current style.
Automatically detects project build tool (npm/yarn/pnpm/bun for JS/TS, cargo for Rust, go for Go, uv/pip for Python).
- Ultrathink: Full verification (all steps)
- Quick: Minimal (build only if risky)
- Collab: Discuss what to verify`,
    
    args: {
      steps: tool.schema.array(tool.schema.string()).optional().describe(
        'Specific steps to run: build, test, lint, typecheck, visual'
      ),
      skipSteps: tool.schema.array(tool.schema.string()).optional().describe(
        'Steps to skip'
      )
    },
    
    async execute(args, context): Promise<string> {
      const style = getStyleState().current;
      const verificationLevel = getStyleVerificationLevel(style);
      
      // Detect project build tool
      const projectDir = getProjectDir ? getProjectDir() : process.cwd();
      const projectInfo = detectProjectInfo(projectDir);
      const buildTool = projectInfo.buildTool || DEFAULT_BUILD_TOOL;
      
      // Generate steps for detected build tool
      const allSteps = generateVerificationSteps(buildTool);
      
      // SECURITY: Validate step names against whitelist
      const VALID_STEP_NAMES = ['build', 'test', 'lint', 'typecheck', 'visual'] as const;
      
      // Filter user-provided steps to only valid values
      const validatedSteps = args.steps?.filter(
        (step: string): step is typeof VALID_STEP_NAMES[number] => 
          VALID_STEP_NAMES.includes(step as typeof VALID_STEP_NAMES[number])
      );
      const validatedSkipSteps = args.skipSteps?.filter(
        (step: string): step is typeof VALID_STEP_NAMES[number] => 
          VALID_STEP_NAMES.includes(step as typeof VALID_STEP_NAMES[number])
      );
      
      let stepsToRun: VerificationStep[];
      
      switch (verificationLevel) {
        case 'full':
          stepsToRun = allSteps.filter(s => s.required);
          break;
        case 'minimal':
          stepsToRun = allSteps.filter(s => s.name === 'build');
          break;
        case 'discuss':
          stepsToRun = [];
          break;
      }
      
      // Apply filters with validated input
      if (validatedSteps?.length) {
        stepsToRun = allSteps.filter(s => validatedSteps.includes(s.name as typeof VALID_STEP_NAMES[number]));
      }
      if (validatedSkipSteps?.length) {
        stepsToRun = stepsToRun.filter(s => !validatedSkipSteps.includes(s.name as typeof VALID_STEP_NAMES[number]));
      }
      
      // Execute verification steps when possible
      // Runtime type guard for exec function (PLAN.md security fix)
      type ExecResult = { stdout?: string; stderr?: string; exitCode?: number };
      type ExecFn = (command: string) => Promise<ExecResult>;
      
      const maybeExec = (context as { exec?: unknown } | undefined)?.exec;
      const exec: ExecFn | undefined = 
        maybeExec && typeof maybeExec === 'function' 
          ? maybeExec as ExecFn 
          : undefined;

      if (!exec) {
        const stepsList = stepsToRun
          .map(s => `### ${s.name}\n\`\`\`bash\n${s.command}\n\`\`\`\n${s.description}`)
          .join('\n\n');

        return `## Verification Protocol [Style: ${style}]

**Detected:** ${projectInfo.type || 'unknown'} project using \`${buildTool}\`

${stepsList}

**Note:** Automatic execution is unavailable in this environment. Run the commands above, then re-run \`setu_verify\` to record results.`;
      }

      const projectDirForLog = getProjectDir ? getProjectDir() : process.cwd();
      const results: Array<{ name: string; success: boolean; output: string }> = [];

      for (const step of stepsToRun) {
        if (step.command === '(manual)') {
          continue;
        }

        try {
          const result = await exec(step.command);
          const outputText = [result.stdout, result.stderr].filter(Boolean).join('\n');
          
          // Strict exitCode check: only explicit 0 is success
          // undefined/null exitCode is treated as failure (unknown state)
          const success = result.exitCode === 0;

          logVerification(projectDirForLog, step.name, success, outputText);
          results.push({ name: step.name, success, output: outputText });
        } catch (execError) {
          // Execution threw - treat as failure
          const errorMsg = execError instanceof Error ? execError.message : String(execError);
          logVerification(projectDirForLog, step.name, false, `Execution error: ${errorMsg}`);
          results.push({ name: step.name, success: false, output: `Execution error: ${errorMsg}` });
        }
      }

      const failures = results.filter(r => !r.success);
      const automatedChecksPassed = failures.length === 0 && results.length > 0;
      
      if (automatedChecksPassed) {
        markVerificationComplete();
        
        // Write result file and advance step (Results Pattern)
        // Reuse projectDirForLog to avoid duplicate logic
        const projectDirForResults = projectDirForLog;
        let completedStep = 1;
        
        try {
          completedStep = advanceStep(projectDirForResults) ?? 1;
        } catch (err) {
          // Log but don't fail verification on step tracking error
          logVerification(projectDirForResults, 'step-advance', false, getErrorMessage(err));
        }
        
        // Build verification summary for result file
        const verificationDetails = results
          .map(r => `${r.name}: ${r.success ? 'PASS' : 'FAIL'}`)
          .join(', ');
        
        // SECURITY: Sanitize all user-influenced fields for YAML safety
        try {
          const active = loadActiveTask(projectDirForResults);
          writeStepResult(projectDirForResults, {
            step: completedStep,
            status: 'completed',
            objective: sanitizeYamlString(active?.task || 'Verification'),
            outputs: [],  // Future: detect from git diff
            summary: sanitizeYamlString(`Step ${completedStep} verified successfully. ${verificationDetails}`),
            verification: sanitizeYamlString(`Build/test/lint passed: ${verificationDetails}`),
            timestamp: new Date().toISOString()
          });
        } catch (writeErr) {
          logVerification(projectDirForResults, 'result-write', false, getErrorMessage(writeErr));
          // Continue - verification passed even if result persistence failed
        }
        
        const summary = results
          .map(r => `- ${r.name}: ${r.success ? 'PASS' : 'FAIL'}`)
          .join('\n');

        return `## Verification Results [Style: ${style}]

**Detected:** ${projectInfo.type || 'unknown'} project using \`${buildTool}\`

${summary}

✅ Step ${completedStep} verified and recorded to .setu/results/step-${completedStep}.md
Next: Step ${completedStep + 1}`;
      }

      if (results.length === 0) {
        let guidance = '';
        if (verificationLevel === 'discuss') {
          guidance = 'Discuss with user what verification is needed.';
        }

        return `## Verification [Style: ${style}]

**Detected:** ${projectInfo.type || 'unknown'} project using \`${buildTool}\`

Verification level: ${verificationLevel}
${guidance}`;
      }

      const summary = results
        .map(r => `- ${r.name}: ${r.success ? 'PASS' : 'FAIL'}`)
        .join('\n');

      return `## Verification Results [Style: ${style}]

**Detected:** ${projectInfo.type || 'unknown'} project using \`${buildTool}\`

${summary}

${failures.length > 0 ? 'One or more checks failed. Review logs in .setu/verification.log.' : 'All checks passed.'}`;
    }
  });
}
