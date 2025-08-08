/**
 * Knowledge Graph Visualization Module
 *
 * Provides a unified interface for visualizing knowledge graphs using different
 * visualization libraries (D3.js, vis-network, Cytoscape.js, Three.js)
 * 
 * Note: Visualization libraries are optional dependencies. If they are not installed,
 * the corresponding visualizers will not be available.
 */

// Always export base types and utilities (no external deps)
export * from './types';
export * from './base';
export * from './utils';

// Export the loader utilities (but not GraphVisualizationManager which is already exported from types)
export { 
  loadVisualizationClasses, 
  isBackendAvailable, 
  getAvailableBackends,
  hasVisualizationSupport,
  type VisualizationLoaders
} from './loader';

// Note: The actual visualization classes (D3GraphVisualizer, etc.) 
// should be imported dynamically using loadVisualizationClasses()
// to avoid errors when optional dependencies are not installed

/**
 * Create a visualization error with helpful instructions
 */
export function createVisualizationError(backend: string): Error {
  return new Error(
    `${backend} visualization is not available. ` +
    `Install the required dependencies with: npm install ${backend} --save-optional`
  );
}