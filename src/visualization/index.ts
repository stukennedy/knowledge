/**
 * Mermaid-based visualization for Knowledge Graphs
 * 
 * Generates Mermaid diagram syntax from knowledge graph data,
 * which can be rendered using any Mermaid-compatible renderer.
 */

import type { KnowledgeGraph } from '../core/KnowledgeGraph';
import type { QueryResult, KnowledgeNode, KnowledgeEdge } from '../types';

export interface MermaidVisualizationOptions {
  direction?: 'TB' | 'TD' | 'BT' | 'RL' | 'LR';
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  maxNodes?: number;
  maxEdges?: number;
  includeProperties?: boolean;
  nodeTypeStyles?: Record<string, string>;
  edgeTypeStyles?: Record<string, string>;
}

export interface MermaidDiagram {
  type: 'graph' | 'flowchart';
  direction: string;
  content: string;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Generates Mermaid diagram syntax from knowledge graph data
 */
export class MermaidGraphVisualizer {
  constructor(private graph: KnowledgeGraph) {}

  /**
   * Generate a Mermaid diagram from a query result
   */
  generateFromQueryResult(
    queryResult: QueryResult,
    options: MermaidVisualizationOptions = {}
  ): MermaidDiagram {
    const direction = options.direction || 'TD';
    const maxNodes = options.maxNodes || 100;
    const maxEdges = options.maxEdges || 200;

    // Limit nodes and edges
    const nodes = queryResult.nodes.slice(0, maxNodes);
    const edges = queryResult.edges.slice(0, maxEdges);

    // Generate Mermaid syntax
    const lines: string[] = [];
    lines.push(`graph ${direction}`);

    // Add nodes with proper escaping
    for (const node of nodes) {
      const nodeId = this.sanitizeId(node.id);
      const label = this.formatNodeLabel(node, options.includeProperties);
      const style = this.getNodeStyle(node.type, options.nodeTypeStyles);
      
      lines.push(`    ${nodeId}["${label}"]`);
      if (style) {
        lines.push(`    style ${nodeId} ${style}`);
      }
    }

    // Add edges
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const edge of edges) {
      // Only include edges where both nodes are in our set
      if (nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)) {
        const fromId = this.sanitizeId(edge.fromNodeId);
        const toId = this.sanitizeId(edge.toNodeId);
        const label = this.formatEdgeLabel(edge, options.includeProperties);
        const arrow = '-->';
        
        if (label) {
          lines.push(`    ${fromId} ${arrow}|"${label}"| ${toId}`);
        } else {
          lines.push(`    ${fromId} ${arrow} ${toId}`);
        }
      }
    }

    return {
      type: 'graph',
      direction,
      content: lines.join('\n'),
      nodeCount: nodes.length,
      edgeCount: edges.filter(e => 
        nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId)
      ).length,
    };
  }

  /**
   * Generate a Mermaid diagram for a specific node and its neighborhood
   */
  async generateFromNode(
    nodeId: string,
    depth: number = 2,
    options: MermaidVisualizationOptions = {}
  ): Promise<MermaidDiagram> {
    const queryResult = await this.graph.queryRelated(nodeId, {
      depth,
      includeEdges: true,
    });

    return this.generateFromQueryResult(queryResult, options);
  }

  /**
   * Generate a Mermaid diagram from a search query
   */
  async generateFromSearch(
    query: string,
    options: MermaidVisualizationOptions = {}
  ): Promise<MermaidDiagram> {
    const queryResult = await this.graph.search({
      query,
      limit: options.maxNodes || 50,
    });

    return this.generateFromQueryResult(queryResult, options);
  }

  /**
   * Generate a Mermaid diagram for specific node types
   */
  async generateFromNodeTypes(
    nodeTypes: string[],
    options: MermaidVisualizationOptions = {}
  ): Promise<MermaidDiagram> {
    const allNodes: KnowledgeNode[] = [];
    const allEdges: KnowledgeEdge[] = [];

    for (const nodeType of nodeTypes) {
      const result = await this.graph.queryByType(nodeType, {
        limit: options.maxNodes || 100,
        includeEdges: true,
      });
      allNodes.push(...result.nodes);
      allEdges.push(...result.edges);
    }

    const queryResult: QueryResult = {
      nodes: allNodes,
      edges: allEdges,
    };

    return this.generateFromQueryResult(queryResult, options);
  }

  /**
   * Sanitize node ID for Mermaid syntax
   */
  private sanitizeId(id: string): string {
    // Replace problematic characters with underscores
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Format node label with optional properties
   */
  private formatNodeLabel(node: KnowledgeNode, includeProperties?: boolean): string {
    let label = this.escapeLabel(node.label);
    
    if (includeProperties && node.properties && Object.keys(node.properties).length > 0) {
      const props = Object.entries(node.properties)
        .slice(0, 3) // Limit to 3 properties for readability
        .map(([key, value]) => `${key}: ${this.formatValue(value)}`)
        .join('<br/>');
      label = `${label}<br/><small>${props}</small>`;
    }

    return `${node.type}: ${label}`;
  }

  /**
   * Format edge label with optional properties
   */
  private formatEdgeLabel(edge: KnowledgeEdge, includeProperties?: boolean): string {
    let label = edge.type.replace(/_/g, ' ').toLowerCase();
    
    if (includeProperties && edge.properties && Object.keys(edge.properties).length > 0) {
      const props = Object.entries(edge.properties)
        .slice(0, 2) // Limit to 2 properties for readability
        .map(([key, value]) => `${key}: ${this.formatValue(value)}`)
        .join(', ');
      label = `${label} (${props})`;
    }

    return this.escapeLabel(label);
  }

  /**
   * Format property value for display
   */
  private formatValue(value: any): string {
    if (typeof value === 'string') {
      return value.length > 20 ? value.substring(0, 20) + '...' : value;
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (typeof value === 'object' && value !== null) {
      return '[object]';
    }
    return String(value);
  }

  /**
   * Escape special characters in labels
   */
  private escapeLabel(label: string): string {
    return label
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, ' ');
  }

  /**
   * Get node style based on type
   */
  private getNodeStyle(nodeType: string, customStyles?: Record<string, string>): string {
    if (customStyles && customStyles[nodeType]) {
      return customStyles[nodeType];
    }

    // Default styles for common node types
    const defaultStyles: Record<string, string> = {
      PERSON: 'fill:#4CAF50,stroke:#333,stroke-width:2px',
      ORGANIZATION: 'fill:#2196F3,stroke:#333,stroke-width:2px',
      LOCATION: 'fill:#FF9800,stroke:#333,stroke-width:2px',
      DOCUMENT: 'fill:#607D8B,stroke:#333,stroke-width:2px',
      CONCEPT: 'fill:#9C27B0,stroke:#333,stroke-width:2px',
      EVENT: 'fill:#F44336,stroke:#333,stroke-width:2px',
      SKILL: 'fill:#00BCD4,stroke:#333,stroke-width:2px',
      PRODUCT: 'fill:#FFEB3B,stroke:#333,stroke-width:2px',
    };

    return defaultStyles[nodeType] || 'fill:#666,stroke:#333,stroke-width:2px';
  }
}

/**
 * Utility functions for working with Mermaid diagrams
 */
export class MermaidUtils {
  /**
   * Wrap Mermaid diagram in HTML for rendering
   */
  static wrapInHtml(diagram: MermaidDiagram, options?: {
    title?: string;
    theme?: string;
  }): string {
    const title = options?.title || 'Knowledge Graph Visualization';
    const theme = options?.theme || 'default';

    return `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({ 
            startOnLoad: true,
            theme: '${theme}',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    </script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .mermaid {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .info {
            margin-top: 20px;
            padding: 10px;
            background: #e3f2fd;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="mermaid">
${diagram.content}
    </div>
    <div class="info">
        <strong>Graph Statistics:</strong> ${diagram.nodeCount} nodes, ${diagram.edgeCount} edges
    </div>
</body>
</html>`;
  }

  /**
   * Generate a URL for rendering with Mermaid Live Editor
   */
  static generateLiveEditorUrl(diagram: MermaidDiagram): string {
    const base64 = Buffer.from(diagram.content).toString('base64');
    
    return `https://mermaid.live/edit#pako:${base64}`;
  }

  /**
   * Convert diagram to Markdown with Mermaid code block
   */
  static toMarkdown(diagram: MermaidDiagram, title?: string): string {
    const header = title ? `# ${title}\n\n` : '';
    return `${header}\`\`\`mermaid
${diagram.content}
\`\`\`

**Graph Statistics:** ${diagram.nodeCount} nodes, ${diagram.edgeCount} edges`;
  }
}

// Export for backward compatibility
export { MermaidGraphVisualizer as GraphVisualizationManager };
export type { MermaidDiagram as GraphSnapshot };

// Stub exports for backward compatibility
export const PerformanceUtils = {
  isSuitableForRealTime: (nodeCount: number, _edgeCount: number) => nodeCount < 100,
  getRecommendedBackend: (_nodeCount: number, _edgeCount: number) => 'mermaid' as const,
};

export const ColorUtils = {
  generateNodeColorPalette: (types: string[]) => {
    const colors: Record<string, string> = {};
    const palette = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    types.forEach((type, i) => {
      colors[type] = palette[i % palette.length] || '#666666';
    });
    return colors;
  },
  generateEdgeColorPalette: (types: string[]) => {
    const colors: Record<string, string> = {};
    types.forEach(type => {
      colors[type] = '#666666';
    });
    return colors;
  },
};

export const LayoutUtils = {
  getLayoutOptionsForGraphSize: (nodeCount: number, _edgeCount: number) => {
    if (nodeCount < 20) return { layout: 'TD' as const };
    if (nodeCount < 50) return { layout: 'LR' as const };
    return { layout: 'TB' as const };
  },
  calculateOptimalNodeSizes: (nodesByType: Record<string, number>, _total: number) => {
    const sizes: Record<string, number> = {};
    Object.keys(nodesByType).forEach(type => {
      sizes[type] = 15;
    });
    return sizes;
  },
  calculateOptimalEdgeWidths: (edgesByType: Record<string, number>, _total: number) => {
    const widths: Record<string, number> = {};
    Object.keys(edgesByType).forEach(type => {
      widths[type] = 2;
    });
    return widths;
  },
};

export type VisualizationBackend = 'mermaid';