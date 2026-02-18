import { describe, test, expect } from 'bun:test';
import { createSetuDoctorTool } from '../setu-doctor';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('setu-doctor project rules check', () => {
  test('reports healthy when AGENTS.md exists', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'setu-doctor-test-'));
    
    try {
      // Create AGENTS.md
      writeFileSync(join(tmpDir, 'AGENTS.md'), '# Project Rules\n\nTest rules');
      
      const doctorTool = createSetuDoctorTool(() => tmpDir);
      const result = await doctorTool.execute({ verbose: true }, {} as any);

      expect(result).toContain('project-rules');
      expect(result).toContain('AGENTS.md found');
      expect(result).not.toContain('No AGENTS.md');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('reports healthy when CLAUDE.md exists (fallback)', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'setu-doctor-test-'));

    try {
      // Create CLAUDE.md but not AGENTS.md
      writeFileSync(join(tmpDir, 'CLAUDE.md'), '# Claude Rules\n\nTest rules');

      const doctorTool = createSetuDoctorTool(() => tmpDir);
      const result = await doctorTool.execute({ verbose: true }, {} as any);

      expect(result).toContain('project-rules');
      expect(result).toContain('CLAUDE.md found (AGENTS.md compatible)');
      expect(result).not.toContain('No AGENTS.md');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('reports warning when neither AGENTS.md nor CLAUDE.md exists', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'setu-doctor-test-'));

    try {
      // Don't create any rules file
      const doctorTool = createSetuDoctorTool(() => tmpDir);
      const result = await doctorTool.execute({ verbose: true }, {} as any);

      expect(result).toContain('project-rules');
      expect(result).toContain('No AGENTS.md or CLAUDE.md found');
      expect(result).toContain('Run /init in OpenCode to generate project rules');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('prefers AGENTS.md over CLAUDE.md when both exist', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'setu-doctor-test-'));

    try {
      // Create both files
      writeFileSync(join(tmpDir, 'AGENTS.md'), '# Project Rules');
      writeFileSync(join(tmpDir, 'CLAUDE.md'), '# Claude Rules');

      const doctorTool = createSetuDoctorTool(() => tmpDir);
      const result = await doctorTool.execute({ verbose: true }, {} as any);
      
      // Should report AGENTS.md (primary), not CLAUDE.md
      expect(result).toContain('AGENTS.md found');
      expect(result).not.toContain('CLAUDE.md found');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
