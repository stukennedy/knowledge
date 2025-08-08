# Knowledge Graph Visualization

The `@fluxgraph/knowledge` package includes a comprehensive visualization system that allows you to create beautiful, interactive visualizations of your knowledge graphs using multiple visualization backends.

## Features

- **Multiple Backends**: Support for D3.js, vis-network, Cytoscape.js, and Three.js
- **Interactive Visualizations**: Zoom, pan, drag, hover, and click interactions
- **Flexible Layouts**: Force-directed, hierarchical, circular, grid, and custom layouts
- **Custom Styling**: Color schemes, node shapes, edge styles, and more
- **Export Capabilities**: Export visualizations as PNG, SVG, or JPEG
- **Performance Optimization**: Automatic optimization for large graphs
- **Event Handling**: Rich event system for custom interactions
- **Snapshot System**: Create visual snapshots from different graph queries

## Quick Start

```typescript
import { createKnowledgeGraph, GraphVisualizationManager, type VisualizationBackend } from '@fluxgraph/knowledge';

// Create a knowledge graph
const graph = createKnowledgeGraph('sqlite', {
  connection: './knowledge.db',
});

await graph.initialize();

// Create visualization manager
const vizManager = new GraphVisualizationManager(graph);

// Initialize visualization with D3.js backend
const container = document.getElementById('graph-container');
await vizManager.initializeVisualization('d3', container, {
  visualization: {
    layout: 'force',
    nodeColors: {
      PERSON: '#4CAF50',
      ORGANIZATION: '#2196F3',
      LOCATION: '#FF9800',
    },
  },
  events: {
    onNodeClick: (node, event) => {
      console.log('Clicked node:', node.label);
    },
  },
});

// Visualize a specific node's network
await vizManager.visualizeNode('node-id', 2);
```

## Visualization Backends

### D3.js

- **Best for**: Small to medium graphs with custom styling
- **Features**: Most customizable, full control over rendering
- **Performance**: Good for up to 500 nodes
- **Use case**: When you need complete control over the visualization

```typescript
await vizManager.initializeVisualization('d3', container, {
  visualization: {
    layout: 'force',
    layoutOptions: {
      force: {
        charge: -1000,
        linkDistance: 100,
        gravity: 0.1,
      },
    },
  },
});
```

### vis-network

- **Best for**: Medium to large graphs with good performance
- **Features**: Built-in physics simulation, clustering, navigation
- **Performance**: Good for up to 2000 nodes
- **Use case**: General-purpose graph visualization

```typescript
await vizManager.initializeVisualization('vis-network', container, {
  visualization: {
    layout: 'force',
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
    },
  },
});
```

### Cytoscape.js

- **Best for**: Professional graph analysis and complex layouts
- **Features**: Extensive layout algorithms, advanced styling
- **Performance**: Good for up to 1000 nodes
- **Use case**: When you need advanced graph analysis features

```typescript
await vizManager.initializeVisualization('cytoscape', container, {
  visualization: {
    layout: 'hierarchical',
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          label: 'data(label)',
        },
      },
    ],
  },
});
```

### Three.js (3D)

- **Best for**: 3D visualizations and spatial relationships
- **Features**: 3D rendering, orbit controls, immersive experience
- **Performance**: Good for up to 500 nodes
- **Use case**: When you want 3D visualization or spatial data

```typescript
await vizManager.initializeVisualization('three', container, {
  visualization: {
    layout: 'force',
    enable3D: true,
  },
});
```

## Visualization Types

### Node Network Visualization

Visualize a specific node and its connections up to a certain depth:

```typescript
// Visualize Alice's network with depth 2
await vizManager.visualizeNode('alice-id', 2, {
  includeMetadata: true,
  transformOptions: {
    nodeColorMapping: {
      PERSON: '#4CAF50',
      ORGANIZATION: '#2196F3',
    },
  },
});
```

### Search Results Visualization

Visualize search results from the knowledge graph:

```typescript
// Search and visualize results
await vizManager.visualizeSearch('engineer', {
  maxNodes: 50,
  minConfidence: 0.5,
});
```

### Node Type Visualization

Visualize all nodes of specific types:

```typescript
// Visualize all people and organizations
await vizManager.visualizeNodeTypes(['PERSON', 'ORGANIZATION'], {
  includeMetadata: true,
});
```

### Custom Query Visualization

Visualize results from custom queries:

```typescript
// Create custom query result
const queryResult = await graph.queryRelated('node-id', {
  depth: 3,
  includeEdges: true,
});

// Visualize the query result
await vizManager.visualizeQueryResult(queryResult, {
  includeMetadata: true,
});
```

## Styling and Customization

### Node Styling

```typescript
const visualizationOptions = {
  nodeColors: {
    PERSON: '#4CAF50',
    ORGANIZATION: '#2196F3',
    LOCATION: '#FF9800',
    SKILL: '#9C27B0',
  },
  nodeSizes: {
    PERSON: 20,
    ORGANIZATION: 25,
    LOCATION: 18,
    SKILL: 15,
  },
  defaultNodeColor: '#666666',
  defaultNodeSize: 15,
};
```

### Edge Styling

```typescript
const visualizationOptions = {
  edgeColors: {
    EMPLOYED_BY: '#2196F3',
    KNOWS: '#4CAF50',
    LOCATED_IN: '#FF9800',
    HAS_SKILL: '#9C27B0',
  },
  defaultEdgeColor: '#999999',
  defaultEdgeWidth: 2,
};
```

### Layout Options

```typescript
const layoutOptions = {
  layout: 'force', // 'force', 'hierarchical', 'circular', 'grid'
  layoutOptions: {
    force: {
      charge: -1000,
      linkDistance: 100,
      gravity: 0.1,
    },
    hierarchical: {
      direction: 'UD',
      nodeSpacing: 150,
      levelSeparation: 200,
    },
  },
};
```

## Event Handling

The visualization system provides rich event handling capabilities:

```typescript
const events = {
  onNodeClick: (node, event) => {
    console.log('Node clicked:', node.label);
    // Show node details, navigate to related nodes, etc.
  },

  onNodeHover: (node, event) => {
    console.log('Node hovered:', node.label);
    // Show tooltip, highlight connections, etc.
  },

  onNodeDrag: (node, event) => {
    console.log('Node dragged:', node.label);
    // Update positions, save layout, etc.
  },

  onEdgeClick: (edge, event) => {
    console.log('Edge clicked:', edge.type);
    // Show edge details, highlight path, etc.
  },

  onEdgeHover: (edge, event) => {
    console.log('Edge hovered:', edge.type);
    // Show tooltip, highlight connected nodes, etc.
  },

  onCanvasClick: (event) => {
    console.log('Canvas clicked');
    // Clear selection, reset view, etc.
  },

  onZoom: (scale, event) => {
    console.log('Zoom level:', scale);
    // Update UI, save view state, etc.
  },

  onPan: (x, y, event) => {
    console.log('Panned to:', x, y);
    // Update UI, save view state, etc.
  },
};
```

## Export Functionality

Export visualizations as images:

```typescript
// Export as PNG
const pngData = await vizManager.exportImage('png', {
  quality: 0.9,
  maxWidth: 1920,
  maxHeight: 1080,
});

// Export as SVG
const svgData = await vizManager.exportImage('svg');

// Export as JPEG
const jpegData = await vizManager.exportImage('jpg', {
  quality: 0.8,
});

// Create download link
const link = document.createElement('a');
link.href = pngData;
link.download = 'knowledge-graph.png';
link.click();
```

## Performance Optimization

### Automatic Backend Selection

The system can automatically recommend the best backend based on graph size:

```typescript
import { PerformanceUtils } from '@fluxgraph/knowledge';

const stats = await graph.getStats();
const recommendedBackend = PerformanceUtils.getRecommendedBackend(stats.nodeCount, stats.edgeCount);

console.log('Recommended backend:', recommendedBackend);
```

### Graph Optimization

For large graphs, the system can optimize the visualization:

```typescript
import { PerformanceUtils } from '@fluxgraph/knowledge';

// Check if graph is suitable for real-time visualization
const isRealTime = PerformanceUtils.isSuitableForRealTime(stats.nodeCount, stats.edgeCount);

// Optimize snapshot for performance
const optimizedSnapshot = PerformanceUtils.optimizeSnapshot(
  snapshot,
  1000 // max nodes
);
```

## Utility Classes

### Color Utilities

```typescript
import { ColorUtils } from '@fluxgraph/knowledge';

// Generate color palettes
const nodeColors = ColorUtils.generateNodeColorPalette(['PERSON', 'ORGANIZATION']);
const edgeColors = ColorUtils.generateEdgeColorPalette(['KNOWS', 'EMPLOYED_BY']);

// Get confidence-based colors
const color = ColorUtils.getConfidenceColor(0.8); // Returns green for high confidence

// Interpolate between colors
const interpolatedColor = ColorUtils.interpolateColor('#ff0000', '#00ff00', 0.5);
```

### Layout Utilities

```typescript
import { LayoutUtils } from '@fluxgraph/knowledge';

// Calculate optimal node sizes
const nodeSizes = LayoutUtils.calculateOptimalNodeSizes(stats.nodesByType, stats.nodeCount);

// Calculate optimal edge widths
const edgeWidths = LayoutUtils.calculateOptimalEdgeWidths(stats.edgesByType, stats.edgeCount);

// Get layout options for graph size
const layoutOptions = LayoutUtils.getLayoutOptionsForGraphSize(stats.nodeCount, stats.edgeCount);
```

## Advanced Usage

### Custom Visualizers

You can create custom visualizers by extending the base class:

```typescript
import { BaseGraphVisualizer } from '@fluxgraph/knowledge';

class CustomGraphVisualizer extends BaseGraphVisualizer {
  protected async initializeBackend(): Promise<void> {
    // Custom initialization logic
  }

  protected async renderBackend(snapshot: GraphSnapshot): Promise<void> {
    // Custom rendering logic
  }

  // Implement other abstract methods...
}
```

### View State Management

Save and restore view states:

```typescript
// Save current view state
const viewState = vizManager.getVisualizer()?.getViewState();

// Restore view state
vizManager.getVisualizer()?.setViewState(viewState);
```

### Snapshot Creation

Create custom snapshots:

```typescript
import { GraphSnapshotCreator } from '@fluxgraph/knowledge';

const snapshotCreator = new GraphSnapshotCreator(graph);

// Create snapshot from query result
const snapshot = await snapshotCreator.createFromQueryResult(queryResult, {
  includeMetadata: true,
  transformOptions: {
    nodeColorMapping: { PERSON: '#4CAF50' },
    edgeColorMapping: { KNOWS: '#2196F3' },
  },
});
```

## Browser Compatibility

The visualization system works in all modern browsers:

- **D3.js**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **vis-network**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Cytoscape.js**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Three.js**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+

## Performance Guidelines

- **Small graphs (< 100 nodes)**: Use any backend, D3.js recommended for custom styling
- **Medium graphs (100-500 nodes)**: vis-network or Cytoscape.js recommended
- **Large graphs (500-1000 nodes)**: vis-network recommended for best performance
- **Very large graphs (> 1000 nodes)**: Consider filtering or clustering

## Troubleshooting

### Common Issues

1. **Visualization not rendering**: Check if the container element exists and has dimensions
2. **Performance issues**: Use the performance utilities to optimize large graphs
3. **Memory leaks**: Always call `destroyVisualization()` when done
4. **Layout not working**: Check if the layout options are compatible with your backend

### Debug Mode

Enable debug mode for more detailed logging:

```typescript
await vizManager.initializeVisualization('d3', container, {
  visualization: {
    debug: true,
  },
});
```

## Examples

See the `examples/` directory for complete working examples:

- `visualization-example.ts`: Comprehensive TypeScript example
- `visualization-demo.html`: Interactive HTML demo

## API Reference

For complete API documentation, see the TypeScript definitions in the source code or run:

```bash
npm run docs
```

The visualization system is designed to be flexible, performant, and easy to use while providing powerful customization options for advanced users.
