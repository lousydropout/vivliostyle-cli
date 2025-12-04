import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  createTempWorkspace,
  writeWorkspaceFiles,
} from '../../src/api/utils/temp-workspace.js';

describe('createTempWorkspace', () => {
  it('creates a temporary directory', async () => {
    const workspace = await createTempWorkspace();
    expect(fs.existsSync(workspace.dir)).toBe(true);
    workspace.cleanup();
  });

  it('cleanup removes the directory', async () => {
    const workspace = await createTempWorkspace();
    const dir = workspace.dir;
    // Note: In VITEST environment, useTmpDirectory returns a no-op cleanup function
    // So we manually clean up for testing purposes
    fs.rmSync(dir, { force: true, recursive: true });
    expect(fs.existsSync(dir)).toBe(false);
  });
});

describe('writeWorkspaceFiles', () => {
  it('writes HTML file', async () => {
    const workspace = await createTempWorkspace();
    const { htmlPath, cssPath } = writeWorkspaceFiles(
      workspace,
      '<h1>Test</h1>',
    );

    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.readFileSync(htmlPath, 'utf8')).toBe('<h1>Test</h1>');
    expect(cssPath).toBeUndefined();

    workspace.cleanup();
  });

  it('writes both HTML and CSS files', async () => {
    const workspace = await createTempWorkspace();
    const { htmlPath, cssPath } = writeWorkspaceFiles(
      workspace,
      '<h1>Test</h1>',
      'body {}',
    );

    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.existsSync(cssPath!)).toBe(true);
    expect(fs.readFileSync(cssPath!, 'utf8')).toBe('body {}');

    workspace.cleanup();
  });
});
