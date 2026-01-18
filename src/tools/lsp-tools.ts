/**
 * LSP Tools - IDE-like capabilities for the agent
 * 
 * These tools provide high-value refactoring and diagnostics capabilities
 * that are safer and more accurate than grep/replace.
 * 
 * NOTE: The ctx.lsp API is not documented in OpenCode's plugin docs.
 * These tools need validation and may not work until the API is confirmed.
 * See ROADMAP.md for investigation status.
 */

import { tool } from '@opencode-ai/plugin';

/**
 * lsp_diagnostics - Get errors and warnings before build
 * 
 * This tool queries the LSP server for diagnostics, providing
 * early error detection without running a full build.
 */
export const lspDiagnosticsTool = tool({
  description: `Get diagnostics (errors, warnings) from the LSP server for a file or workspace.
Use this to check for issues before building, or to understand what's broken.
Much faster than running a full build.

NOTE: This tool requires LSP integration which may not be available in all environments.`,
  
  args: {
    filePath: tool.schema.string().optional().describe(
      'Path to specific file. If omitted, returns workspace-wide diagnostics.'
    ),
    severity: tool.schema.enum(['error', 'warning', 'info', 'hint']).optional().describe(
      'Filter by severity level. Defaults to showing errors and warnings.'
    ),
    limit: tool.schema.number().optional().describe(
      'Maximum number of diagnostics to return. Defaults to 50.'
    )
  },
  
  async execute(args, _context): Promise<string> {
    const { filePath } = args;
    
    // LSP API is not available in the current OpenCode plugin API
    // This tool is a placeholder for future implementation
    return `## LSP Diagnostics

**Status:** LSP integration is not yet available in the OpenCode plugin API.

**Workaround:** Use the following command instead:
\`\`\`bash
npm run build 2>&1 | tail -30
\`\`\`

${filePath ? `Requested file: ${filePath}` : 'Requested: workspace-wide diagnostics'}

See setu-opencode ROADMAP.md for LSP integration status.`;
  }
});

/**
 * lsp_rename - Safe symbol renaming across workspace
 * 
 * This tool uses the LSP to rename symbols properly, updating all
 * references across the codebase. Much safer than grep/replace.
 */
export const lspRenameTool = tool({
  description: `Rename a symbol (variable, function, class, etc.) across the entire workspace.
Uses LSP for accurate, safe renaming that updates all references.
Much safer than grep/replace which can cause false positives.

NOTE: This tool requires LSP integration which may not be available in all environments.`,
  
  args: {
    filePath: tool.schema.string().describe(
      'Path to the file containing the symbol'
    ),
    line: tool.schema.number().describe(
      'Line number where the symbol is defined (1-based)'
    ),
    column: tool.schema.number().describe(
      'Column number where the symbol starts (1-based)'
    ),
    newName: tool.schema.string().describe(
      'The new name for the symbol'
    ),
    preview: tool.schema.boolean().optional().describe(
      'If true, show what would change without applying. Defaults to false.'
    )
  },
  
  async execute(args, _context): Promise<string> {
    const { filePath, line, column, newName, preview } = args;
    
    // LSP API is not available in the current OpenCode plugin API
    // This tool is a placeholder for future implementation
    return `## LSP Rename

**Status:** LSP integration is not yet available in the OpenCode plugin API.

**Workaround:** Use grep and edit tools instead:
1. Search: \`grep -rn "symbolName" --include="*.ts"\`
2. Review matches carefully
3. Edit each file

**Requested rename:**
- File: ${filePath}
- Position: line ${line}, column ${column}
- New name: ${newName}
- Preview: ${preview ? 'yes' : 'no'}

See setu-opencode ROADMAP.md for LSP integration status.`;
  }
});

export const lspTools = {
  lsp_diagnostics: lspDiagnosticsTool,
  lsp_rename: lspRenameTool
};
