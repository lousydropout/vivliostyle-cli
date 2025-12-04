import upath from 'upath';
import { RenderRequest } from './validate-request.js';

/**
 * Create a valid BuildTask for Vivliostyle.
 * Required fields: entry, workspaceDir, output
 *
 * IMPORTANT: Entry paths must be relative to workspaceDir, not absolute.
 * Absolute paths starting with '/' are treated as URIs by Vivliostyle,
 * which causes HTTP fetch attempts instead of local file reads.
 */
export function createBuildTask(
  workspaceDir: string,
  htmlPath: string,
  outputPath: string,
  outputFormat: 'pdf' | 'epub',
  request: RenderRequest,
) {
  // Convert absolute paths to relative paths
  // This is critical: Vivliostyle treats paths starting with '/' as URIs
  const relativeHtmlPath = upath.relative(workspaceDir, htmlPath);
  const relativeOutputPath = upath.relative(workspaceDir, outputPath);

  return {
    entry: [{ path: relativeHtmlPath }],
    workspaceDir,
    title: request.metadata?.title,
    author: request.metadata?.author,
    language: request.metadata?.language,
    output: [{ path: relativeOutputPath, format: outputFormat }],
  };
}
