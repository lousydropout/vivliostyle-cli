import fs from 'node:fs';
import upath from 'upath';
import { useTmpDirectory } from '../../util.js';

export interface TempWorkspace {
  dir: string;
  cleanup: () => void;
}

export async function createTempWorkspace(): Promise<TempWorkspace> {
  const [dir, cleanup] = await useTmpDirectory();
  return { dir, cleanup };
}

/**
 * Write HTML and CSS to workspace as separate files.
 * DO NOT mutate HTML to inject CSS links - let Vivliostyle compile handle CSS.
 */
export function writeWorkspaceFiles(
  workspace: TempWorkspace,
  html: string,
  css?: string,
): { htmlPath: string; cssPath?: string } {
  const htmlPath = upath.join(workspace.dir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  let cssPath: string | undefined;
  if (css) {
    cssPath = upath.join(workspace.dir, 'styles.css');
    fs.writeFileSync(cssPath, css, 'utf8');
  }

  return { htmlPath, cssPath };
}
