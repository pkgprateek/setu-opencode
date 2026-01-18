/**
 * LSP Tools - IDE-like capabilities for the agent
 * 
 * These tools provide high-value refactoring and diagnostics capabilities
 * that are safer and more accurate than grep/replace.
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
Much faster than running a full build.`,
  
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
  
  async execute(args, ctx) {
    const { filePath, severity = 'warning', limit = 50 } = args;
    
    try {
      // Query LSP diagnostics via OpenCode's LSP integration
      const diagnostics = await ctx.lsp.getDiagnostics({
        uri: filePath ? `file://${filePath}` : undefined,
        minSeverity: severity
      });
      
      if (!diagnostics || diagnostics.length === 0) {
        return {
          success: true,
          count: 0,
          message: filePath 
            ? `No diagnostics found for ${filePath}`
            : 'No diagnostics found in workspace'
        };
      }
      
      // Format diagnostics for readability
      const formatted = diagnostics
        .slice(0, limit)
        .map(d => ({
          file: d.uri.replace('file://', ''),
          line: d.range.start.line + 1,
          severity: d.severity,
          message: d.message,
          source: d.source
        }));
      
      const summary = {
        errors: diagnostics.filter(d => d.severity === 'error').length,
        warnings: diagnostics.filter(d => d.severity === 'warning').length,
        total: diagnostics.length
      };
      
      return {
        success: true,
        count: formatted.length,
        summary,
        diagnostics: formatted,
        message: `Found ${summary.errors} errors, ${summary.warnings} warnings`
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: 'Failed to get diagnostics. Is the LSP server running?'
      };
    }
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
Much safer than grep/replace which can cause false positives.`,
  
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
  
  async execute(args, ctx) {
    const { filePath, line, column, newName, preview = false } = args;
    
    try {
      // First, prepare the rename to validate it's possible
      const prepareResult = await ctx.lsp.prepareRename({
        uri: `file://${filePath}`,
        position: { line: line - 1, character: column - 1 }
      });
      
      if (!prepareResult) {
        return {
          success: false,
          message: 'Cannot rename symbol at this position. It may not be a renamable identifier.'
        };
      }
      
      // Get the current name
      const currentName = prepareResult.placeholder || '(unknown)';
      
      // Perform the rename (or preview)
      const edits = await ctx.lsp.rename({
        uri: `file://${filePath}`,
        position: { line: line - 1, character: column - 1 },
        newName
      });
      
      if (!edits || Object.keys(edits.changes || {}).length === 0) {
        return {
          success: false,
          message: 'No changes would result from this rename.'
        };
      }
      
      // Count affected files and locations
      const changes = edits.changes || {};
      const fileCount = Object.keys(changes).length;
      const totalEdits = Object.values(changes).reduce(
        (sum, fileEdits) => sum + fileEdits.length, 
        0
      );
      
      // Format for preview
      const preview_changes = Object.entries(changes).map(([uri, fileEdits]) => ({
        file: uri.replace('file://', ''),
        locations: fileEdits.map(e => ({
          line: e.range.start.line + 1,
          column: e.range.start.character + 1
        }))
      }));
      
      if (preview) {
        return {
          success: true,
          preview: true,
          currentName,
          newName,
          fileCount,
          totalEdits,
          changes: preview_changes,
          message: `Would rename '${currentName}' to '${newName}' in ${fileCount} files (${totalEdits} locations)`
        };
      }
      
      // Apply the edits
      await ctx.lsp.applyWorkspaceEdit(edits);
      
      return {
        success: true,
        applied: true,
        currentName,
        newName,
        fileCount,
        totalEdits,
        changes: preview_changes,
        message: `Renamed '${currentName}' to '${newName}' in ${fileCount} files (${totalEdits} locations)`
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        message: 'Rename failed. Check if the symbol exists and LSP is available.'
      };
    }
  }
});

export const lspTools = {
  lsp_diagnostics: lspDiagnosticsTool,
  lsp_rename: lspRenameTool
};
