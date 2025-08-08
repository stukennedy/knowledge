/**
 * Conditional loader for visualization dependencies
 * This allows the library to work without visualization dependencies
 */

import type { BaseGraphVisualizer } from './base';

export interface VisualizationLoaders {
  D3GraphVisualizer: typeof BaseGraphVisualizer | null;
  VisNetworkGraphVisualizer: typeof BaseGraphVisualizer | null;
  CytoscapeGraphVisualizer: typeof BaseGraphVisualizer | null;
  ThreeGraphVisualizer: typeof BaseGraphVisualizer | null;
  createVisualizationManager: (() => any) | null;
  hasVisualizationSupport: boolean;
}

// Check if visualization dependencies are available
let hasD3 = false;
let hasVisNetwork = false;
let hasCytoscape = false;
let hasThree = false;

try {
  require.resolve('d3');
  hasD3 = true;
} catch {}

try {
  require.resolve('vis-network');
  require.resolve('vis-data');
  hasVisNetwork = true;
} catch {}

try {
  require.resolve('cytoscape');
  hasCytoscape = true;
} catch {}

try {
  require.resolve('three');
  hasThree = true;
} catch {}

export const hasVisualizationSupport = hasD3 || hasVisNetwork || hasCytoscape || hasThree;

/**
 * Dynamically load visualization classes based on available dependencies
 */
export async function loadVisualizationClasses(): Promise<VisualizationLoaders> {
  const loaders: VisualizationLoaders = {
    D3GraphVisualizer: null,
    VisNetworkGraphVisualizer: null,
    CytoscapeGraphVisualizer: null,
    ThreeGraphVisualizer: null,
    createVisualizationManager: null,
    hasVisualizationSupport,
  };

  if (hasD3) {
    try {
      const { D3GraphVisualizer } = await import('./d3');
      loaders.D3GraphVisualizer = D3GraphVisualizer as any;
    } catch (e) {
      console.warn('Failed to load D3GraphVisualizer:', e);
    }
  }

  if (hasVisNetwork) {
    try {
      const { VisNetworkGraphVisualizer } = await import('./vis-network');
      loaders.VisNetworkGraphVisualizer = VisNetworkGraphVisualizer as any;
    } catch (e) {
      console.warn('Failed to load VisNetworkGraphVisualizer:', e);
    }
  }

  if (hasCytoscape) {
    try {
      const { CytoscapeGraphVisualizer } = await import('./cytoscape');
      loaders.CytoscapeGraphVisualizer = CytoscapeGraphVisualizer as any;
    } catch (e) {
      console.warn('Failed to load CytoscapeGraphVisualizer:', e);
    }
  }

  if (hasThree) {
    try {
      const { ThreeGraphVisualizer } = await import('./three');
      loaders.ThreeGraphVisualizer = ThreeGraphVisualizer as any;
    } catch (e) {
      console.warn('Failed to load ThreeGraphVisualizer:', e);
    }
  }

  // Create a manager factory if any visualizers are available
  if (hasVisualizationSupport) {
    loaders.createVisualizationManager = () => {
      const manager: any = {
        visualizers: new Map(),
        
        register(name: string, visualizer: BaseGraphVisualizer) {
          this.visualizers.set(name, visualizer);
        },
        
        get(name: string): BaseGraphVisualizer | undefined {
          return this.visualizers.get(name);
        },
        
        list(): string[] {
          return Array.from(this.visualizers.keys());
        },
        
        getAvailableBackends(): string[] {
          const backends: string[] = [];
          if (hasD3) backends.push('d3');
          if (hasVisNetwork) backends.push('vis-network');
          if (hasCytoscape) backends.push('cytoscape');
          if (hasThree) backends.push('three');
          return backends;
        }
      };
      
      return manager;
    };
  }

  return loaders;
}

/**
 * Helper function to check if a specific visualization backend is available
 */
export function isBackendAvailable(backend: 'd3' | 'vis-network' | 'cytoscape' | 'three'): boolean {
  switch (backend) {
    case 'd3':
      return hasD3;
    case 'vis-network':
      return hasVisNetwork;
    case 'cytoscape':
      return hasCytoscape;
    case 'three':
      return hasThree;
    default:
      return false;
  }
}

/**
 * Get list of available visualization backends
 */
export function getAvailableBackends(): string[] {
  const backends: string[] = [];
  if (hasD3) backends.push('d3');
  if (hasVisNetwork) backends.push('vis-network');
  if (hasCytoscape) backends.push('cytoscape');
  if (hasThree) backends.push('three');
  return backends;
}