# @fluxgraph/knowledge

A flexible, database-agnostic knowledge graph implementation for TypeScript. Build powerful graph-based knowledge representations with support for multiple database backends including Cloudflare D1, SQLite, and more.

## Features

- 🗄️ **Multiple Database Backends** - SQLite, Cloudflare D1, LibSQL (Turso)
- 🔍 **Full-Text Search** - Built-in search indexing and querying
- 🧠 **Knowledge Extraction** - Extract entities and relationships from text
- 📊 **Graph Algorithms** - Path finding, centrality, community detection
- 🚀 **High Performance** - Optimized queries with proper indexing
- 🔒 **Type Safe** - Full TypeScript support with generics
- 💾 **Transaction Support** - Atomic operations for data consistency
- 🎯 **Flexible Schema** - Extensible node and edge types

## Installation

```bash
npm install @fluxgraph/knowledge

# For SQLite support
npm install better-sqlite3

# For Cloudflare D1 support
npm install @cloudflare/workers-types

# For LibSQL support
npm install @libsql/client
```

## Quick Start

```typescript
import { createKnowledgeGraph, NodeType, EdgeType } from '@fluxgraph/knowledge';

// Create a knowledge graph with SQLite
const graph = createKnowledgeGraph('sqlite', {
  connection: './my-knowledge.db' // or ':memory:' for in-memory
});

await graph.initialize();

// Add nodes
const person = await graph.addNode({
  type: NodeType.PERSON,
  label: 'Alice Johnson',
  properties: {
    email: 'alice@example.com',
    age: 28
  }
});

const company = await graph.addNode({
  type: NodeType.ORGANIZATION,
  label: 'TechCorp',
  properties: {
    industry: 'Technology'
  }
});

// Create relationships
await graph.addEdge({
  type: EdgeType.EMPLOYED_BY,
  fromNodeId: person.id,
  toNodeId: company.id,
  properties: {
    since: '2020-01-15'
  }
});

// Query the graph
const colleagues = await graph.queryRelated(person.id, {
  depth: 2,
  edgeTypes: [EdgeType.COLLEAGUE_OF]
});

// Search
const results = await graph.search({
  query: 'alice tech',
  limit: 10
});
```

## Database Adapters

### SQLite (Node.js)

```typescript
import { createKnowledgeGraph } from '@fluxgraph/knowledge';

const graph = createKnowledgeGraph('sqlite', {
  connection: './database.db',
  debug: true
});
```

### Cloudflare D1

```typescript
import { D1Adapter, KnowledgeGraph } from '@fluxgraph/knowledge';

export default {
  async fetch(request: Request, env: Env) {
    const adapter = new D1Adapter({ database: env.DB });
    const graph = new KnowledgeGraph(adapter);
    await graph.initialize();
    
    // Use the graph...
  }
}
```

### Custom Adapter

```typescript
import { BaseAdapter, KnowledgeGraph } from '@fluxgraph/knowledge';

class MyCustomAdapter extends BaseAdapter {
  // Implement required methods...
}

const graph = new KnowledgeGraph(new MyCustomAdapter(config));
```

## Core Concepts

### Nodes

Nodes represent entities in your knowledge graph:

```typescript
const node = await graph.addNode({
  type: NodeType.PERSON,        // or custom string
  label: 'Unique Label',         // Human-readable identifier
  properties: {                  // Custom properties
    key: 'value',
    nested: { data: true }
  },
  confidence: 0.95,              // Confidence score (0-1)
  sourceSessionId: 'session-123' // Track data source
});
```

### Edges

Edges represent relationships between nodes:

```typescript
const edge = await graph.addEdge({
  type: EdgeType.KNOWS,
  fromNodeId: node1.id,
  toNodeId: node2.id,
  properties: {
    since: '2020',
    strength: 'strong'
  },
  bidirectional: true  // Creates edges in both directions
});
```

### Standard Types

Built-in node types:
- `PERSON`, `ORGANIZATION`, `LOCATION`, `EVENT`
- `DOCUMENT`, `CONCEPT`, `TOPIC`, `SKILL`
- `PRODUCT`, `SERVICE`, `FINANCIAL`, `GOAL`

Built-in edge types:
- Relationships: `KNOWS`, `FRIEND_OF`, `COLLEAGUE_OF`
- Family: `PARENT_OF`, `CHILD_OF`, `SIBLING_OF`
- Work: `EMPLOYED_BY`, `MANAGES`, `REPORTS_TO`
- Location: `LIVES_AT`, `WORKS_AT`, `LOCATED_IN`
- Ownership: `OWNS`, `CREATED_BY`

## Querying

### Query by Type

```typescript
const documents = await graph.queryByType(NodeType.DOCUMENT, {
  limit: 50,
  offset: 0,
  minConfidence: 0.7
});
```

### Query Related Nodes

```typescript
const network = await graph.queryRelated(nodeId, {
  depth: 3,                    // Traversal depth
  direction: 'both',           // 'in', 'out', or 'both'
  edgeTypes: [EdgeType.KNOWS], // Filter by edge types
  includeEdges: true           // Include edges in result
});
```

### Find Paths

```typescript
// Shortest path
const path = await graph.findShortestPath(fromId, toId, {
  edgeTypes: [EdgeType.KNOWS, EdgeType.COLLEAGUE_OF]
});

// All paths (with graph algorithms)
import { GraphAlgorithms } from '@fluxgraph/knowledge/algorithms';

const algorithms = new GraphAlgorithms(graph);
const allPaths = await algorithms.findAllPaths(fromId, toId, maxLength);
```

### Search

```typescript
const results = await graph.search({
  query: 'machine learning python',
  nodeTypes: [NodeType.DOCUMENT, NodeType.SKILL],
  fuzzy: true,
  limit: 20,
  minScore: 0.5
});
```

## Knowledge Extraction

Extract entities and relationships from text:

```typescript
import { KnowledgeExtractor } from '@fluxgraph/knowledge/extraction';

const extractor = new KnowledgeExtractor(graph);

// Extract from text
const extraction = await extractor.extractFromText(
  'Alice Johnson (alice@example.com) works at TechCorp in San Francisco.',
  {
    extractEntities: true,
    extractRelationships: true,
    minConfidence: 0.6
  }
);

// Process and add to graph
const { nodesAdded, edgesAdded } = await extractor.processExtractedKnowledge(
  extraction,
  { mergeStrategy: 'merge' }
);

// Extract from conversation
const messages = [
  { role: 'user', content: 'I work with Bob on the AI project' },
  { role: 'assistant', content: 'Tell me more about the AI project' }
];

const conversationKnowledge = await extractor.extractFromConversation(messages);
```

### Custom Extraction Patterns

```typescript
// Add custom entity pattern
extractor.addEntityPattern({
  pattern: /PROJECT-\d{4}/g,
  type: NodeType.PROJECT,
  extractor: (match) => ({
    label: match[0],
    properties: { 
      projectId: match[0],
      type: 'internal'
    }
  })
});

// Add custom relationship pattern
extractor.addRelationshipPattern({
  pattern: /(\w+) manages (\w+)/g,
  type: EdgeType.MANAGES,
  extractor: (match, nodes) => ({
    fromNodeLabel: match[1],
    toNodeLabel: match[2],
    properties: { extractedFrom: 'text' }
  })
});
```

## Graph Algorithms

```typescript
import { GraphAlgorithms } from '@fluxgraph/knowledge/algorithms';

const algorithms = new GraphAlgorithms(graph);

// Centrality measures
const degree = await algorithms.degreeCentrality(nodeId);
const pagerank = await algorithms.pageRank();

// Community detection
const communities = await algorithms.detectCommunities();

// Find cliques
const cliques = await algorithms.findCliques(minSize);

// Detect cycles
const cycles = await algorithms.detectCycles();

// Clustering coefficient
const coefficient = await algorithms.clusteringCoefficient(nodeId);

// Connected components
const components = await algorithms.findConnectedComponents();
```

## Batch Operations

```typescript
// Batch add nodes
const result = await graph.batchAddNodes([
  { type: NodeType.PERSON, label: 'Person 1' },
  { type: NodeType.PERSON, label: 'Person 2' },
  { type: NodeType.PERSON, label: 'Person 3' }
]);

console.log(`Added ${result.successful} nodes, ${result.failed} failed`);

// Batch add edges
const edgeResult = await graph.batchAddEdges([
  { type: EdgeType.KNOWS, fromNodeId: id1, toNodeId: id2 },
  { type: EdgeType.KNOWS, fromNodeId: id2, toNodeId: id3 }
]);
```

## Transactions

```typescript
import { SQLiteAdapter } from '@fluxgraph/knowledge/adapters';

const adapter = new SQLiteAdapter({ connection: './db.sqlite' });

await adapter.transaction(async (tx) => {
  // All operations in transaction
  await tx.execute('INSERT INTO kg_nodes ...');
  await tx.execute('INSERT INTO kg_edges ...');
  
  // Rollback on error
  if (error) {
    await tx.rollback();
  }
});
```

## Statistics

```typescript
const stats = await graph.getStats();

console.log({
  nodes: stats.nodeCount,
  edges: stats.edgeCount,
  averageDegree: stats.averageDegree,
  density: stats.density,
  nodesByType: stats.nodesByType,
  edgesByType: stats.edgesByType
});
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Application Layer             │
├─────────────────────────────────────────┤
│         KnowledgeGraph API              │
├─────────────────────────────────────────┤
│   Extraction │ Algorithms │ Search      │
├─────────────────────────────────────────┤
│         Database Adapter Layer          │
├──────────┬──────────┬──────────────────┤
│  SQLite  │    D1    │     LibSQL       │
└──────────┴──────────┴──────────────────┘
```

### Database Schema

The knowledge graph uses the following tables:

- `kg_nodes` - Stores all graph nodes
- `kg_edges` - Stores relationships between nodes
- `kg_node_indices` - Indexes for efficient node lookups
- `kg_edge_indices` - Indexes for efficient edge lookups
- `kg_search_index` - Full-text search index
- `kg_graph_metadata` - Graph-level metadata

## Performance Tips

1. **Use Indexes**: The library automatically creates indexes for common queries
2. **Batch Operations**: Use batch methods for bulk inserts
3. **Limit Depth**: Keep traversal depth reasonable (usually ≤ 3)
4. **Cache Results**: Cache frequently accessed paths and queries
5. **Vacuum Regularly**: Run `graph.vacuum()` periodically for SQLite

## Use Cases

- 🧠 **Personal Knowledge Management** - Build a personal knowledge base
- 💼 **CRM Systems** - Track customer relationships and interactions
- 🔬 **Research Tools** - Organize research data and citations
- 🤖 **AI Memory Systems** - Long-term memory for chatbots and agents
- 📊 **Recommendation Engines** - Build recommendation systems
- 🏢 **Enterprise Knowledge Bases** - Organizational knowledge management
- 📚 **Educational Platforms** - Track learning paths and prerequisites
- 🔍 **Fraud Detection** - Analyze relationship networks

## Examples

See the [examples](./examples) directory for:
- Basic usage and CRUD operations
- Knowledge extraction from documents
- Building a chat memory system
- Social network analysis
- Recommendation engine
- Migration from other graph databases

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting PRs.

## License

MIT © Stu Kennedy

## Links

- [GitHub Repository](https://github.com/fluxgraph/knowledge)
- [NPM Package](https://www.npmjs.com/package/@fluxgraph/knowledge)
- [Documentation](https://github.com/fluxgraph/knowledge#readme)
- [Issue Tracker](https://github.com/fluxgraph/knowledge/issues)