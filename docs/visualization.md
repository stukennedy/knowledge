# Knowledge Graph Visualization

The `@fluxgraph/knowledge` package includes a Mermaid-based visualization system that allows you to create clear, portable visualizations of your knowledge graphs.

## Features

- **Mermaid Diagrams**: Generate standard Mermaid diagram syntax
- **Multiple Output Formats**: Markdown, HTML, or Mermaid Live Editor
- **Flexible Layouts**: Top-Down (TD), Left-Right (LR), and other Mermaid layouts
- **Custom Styling**: Node and edge styling through Mermaid syntax
- **Lightweight**: No heavy dependencies, just text-based diagrams
- **Version Control Friendly**: Text format is easy to diff and merge
- **Wide Compatibility**: Works in GitHub, GitLab, documentation tools, etc.

## Quick Start

```typescript
import { KnowledgeGraph, SQLiteAdapter, MermaidGraphVisualizer, MermaidUtils } from '@fluxgraph/knowledge';

// Create a knowledge graph
const adapter = new SQLiteAdapter({
  connection: './knowledge.db',
});
const graph = new KnowledgeGraph(adapter);
await graph.initialize();

// Create Mermaid visualizer
const visualizer = new MermaidGraphVisualizer(graph);

// Visualize a specific node's network
const diagram = await visualizer.generateFromNode('node-id', 2, {
  direction: 'TD',
  includeProperties: true,
});

// Output as Markdown
const markdown = MermaidUtils.toMarkdown(diagram, 'My Graph');
console.log(markdown);
```

## Visualization Methods

### Visualize Node Network

Visualize a specific node and its connections up to a certain depth:

```typescript
const diagram = await visualizer.generateFromNode(nodeId, depth, {
  direction: 'TD', // or 'LR', 'BT', 'RL'
  includeProperties: true,
  maxNodes: 50,
  maxEdges: 100,
});
```

### Visualize Search Results

Create a diagram from search results:

```typescript
const diagram = await visualizer.generateFromSearch('engineer', {
  maxNodes: 20,
  includeProperties: false,
});
```

### Visualize by Node Types

Show all nodes of specific types:

```typescript
const diagram = await visualizer.generateFromNodeTypes(['PERSON', 'ORGANIZATION'], {
  direction: 'LR',
  includeProperties: true,
});
```

### Visualize Query Results

Create a diagram from any query result:

```typescript
const queryResult = await graph.queryRelated(nodeId, { depth: 2 });
const diagram = visualizer.generateFromQueryResult(queryResult, {
  direction: 'TD',
  includeProperties: false,
});
```

## Output Formats

### Markdown Output

Perfect for documentation, README files, and wikis:

```typescript
const markdown = MermaidUtils.toMarkdown(diagram, 'Knowledge Graph');
// Returns:
// # Knowledge Graph
// 
// ```mermaid
// graph TD
//   node1["Label"]
//   ...
// ```
// 
// **Graph Statistics:** X nodes, Y edges
```

### HTML Output

Generate a complete HTML page with embedded Mermaid viewer:

```typescript
const html = MermaidUtils.wrapInHtml(diagram, {
  title: 'My Knowledge Graph',
  theme: 'default', // or 'dark', 'forest', 'neutral'
});

// Save to file
await fs.writeFile('graph.html', html);
```

### Mermaid Live Editor

Get a URL to edit the diagram online:

```typescript
const editorUrl = MermaidUtils.generateLiveEditorUrl(diagram);
console.log(`Edit online: ${editorUrl}`);
```

## Configuration Options

### Direction

Control the flow direction of the graph:

- `'TD'` or `'TB'` - Top to Bottom
- `'BT'` - Bottom to Top
- `'LR'` - Left to Right
- `'RL'` - Right to Left

### Node Styling

Customize node appearance by type:

```typescript
const options = {
  nodeTypeStyles: {
    PERSON: 'fill:#4CAF50,stroke:#333,stroke-width:2px',
    ORGANIZATION: 'fill:#2196F3,stroke:#333,stroke-width:2px',
    LOCATION: 'fill:#FF9800,stroke:#333,stroke-width:2px',
  }
};
```

### Properties Display

Control whether to show node/edge properties:

```typescript
const options = {
  includeProperties: true, // Show properties in labels
};
```

### Size Limits

Prevent diagrams from becoming too large:

```typescript
const options = {
  maxNodes: 50,  // Maximum number of nodes
  maxEdges: 100, // Maximum number of edges
};
```

## Example: Complete Visualization Workflow

```typescript
import { KnowledgeGraph, SQLiteAdapter, MermaidGraphVisualizer, MermaidUtils } from '@fluxgraph/knowledge';
import * as fs from 'fs/promises';

async function visualizeKnowledgeGraph() {
  // Initialize graph
  const adapter = new SQLiteAdapter({ connection: './knowledge.db' });
  const graph = new KnowledgeGraph(adapter);
  await graph.initialize();

  // Create visualizer
  const visualizer = new MermaidGraphVisualizer(graph);

  // Generate diagram for a person's network
  const person = await graph.findNodesByLabel('Alice Johnson');
  const diagram = await visualizer.generateFromNode(person[0].id, 2, {
    direction: 'TD',
    includeProperties: true,
    nodeTypeStyles: {
      PERSON: 'fill:#4CAF50',
      ORGANIZATION: 'fill:#2196F3',
    },
  });

  // Output in multiple formats
  
  // 1. Save as Markdown for documentation
  const markdown = MermaidUtils.toMarkdown(diagram, "Alice's Network");
  await fs.writeFile('docs/alice-network.md', markdown);

  // 2. Generate HTML for web viewing
  const html = MermaidUtils.wrapInHtml(diagram, {
    title: "Alice's Professional Network",
    theme: 'default',
  });
  await fs.writeFile('visualizations/alice-network.html', html);

  // 3. Get Live Editor URL for interactive editing
  const editorUrl = MermaidUtils.generateLiveEditorUrl(diagram);
  console.log(`Edit diagram online: ${editorUrl}`);

  // 4. Print diagram stats
  console.log(`Generated diagram with ${diagram.nodeCount} nodes and ${diagram.edgeCount} edges`);
  
  await graph.close();
}
```

## Rendering Mermaid Diagrams

### In Markdown Files

Mermaid diagrams in Markdown are automatically rendered by:
- GitHub
- GitLab
- Many documentation tools (MkDocs, Docusaurus, etc.)
- VS Code with Mermaid extensions
- Obsidian and other note-taking apps

### In Web Pages

Add Mermaid.js to your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true });</script>

<div class="mermaid">
  <!-- Paste diagram content here -->
  graph TD
    A[Node] --> B[Another Node]
</div>
```

### In Node.js Applications

Use the generated HTML or serve it through your web framework:

```typescript
app.get('/graph/:nodeId', async (req, res) => {
  const diagram = await visualizer.generateFromNode(req.params.nodeId, 2);
  const html = MermaidUtils.wrapInHtml(diagram, {
    title: 'Knowledge Graph Visualization',
  });
  res.send(html);
});
```

## Performance Considerations

Mermaid diagrams are lightweight and render quickly, but for very large graphs:

1. **Use `maxNodes` and `maxEdges`** to limit diagram size
2. **Reduce depth** when visualizing node networks
3. **Disable properties** (`includeProperties: false`) for cleaner diagrams
4. **Use specific node types** instead of visualizing everything

## Why Mermaid?

We chose Mermaid for knowledge graph visualization because:

1. **No Dependencies**: Unlike D3, Three.js, or Cytoscape, Mermaid requires no heavy libraries
2. **Text-Based**: Diagrams are just text, making them easy to version control
3. **Portable**: Works everywhere - documentation, wikis, web pages
4. **Maintainable**: Simple to understand and modify
5. **Accessible**: Screen reader friendly when properly rendered
6. **Standard**: Widely adopted format with excellent tooling support

## Migration from Previous Versions

If you're upgrading from a version that used D3/Three.js/Cytoscape backends:

1. Replace `GraphVisualizationManager` with `MermaidGraphVisualizer`
2. Update visualization method calls (see examples above)
3. Remove any frontend dependencies on visualization libraries
4. Update your rendering logic to use Mermaid.js or embed in Markdown

The API has been simplified while maintaining the core functionality of generating graph visualizations from your knowledge graph data.