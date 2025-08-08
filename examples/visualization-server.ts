#!/usr/bin/env bun

/**
 * Bun server for the Knowledge Graph Visualization Demo
 *
 * This server provides:
 * - Static file serving for the HTML demo
 * - API endpoints for graph operations
 * - Real-time visualization using the @fluxgraph/knowledge library
 */

import { createKnowledgeGraph, GraphVisualizationManager, CommonEdgeType } from '../src';
import type { KnowledgeGraph } from '../src';

const PORT = 3000;

// Initialize knowledge graph
let graph: KnowledgeGraph | null = null;
let vizManager: GraphVisualizationManager | null = null;

async function initializeGraph() {
  graph = await createKnowledgeGraph('sqlite', {
    connection: ':memory:',
    debug: false,
  });

  await graph.initialize();
  vizManager = new GraphVisualizationManager(graph);

  // Create sample data
  await createSampleData();

  console.log('✅ Knowledge graph initialized with sample data');
}

async function createSampleData() {
  if (!graph) return;

  // Add people
  const alice = await graph.addNode({
    type: 'PERSON',
    label: 'Alice Johnson',
    properties: {
      email: 'alice@example.com',
      age: 28,
      occupation: 'Software Engineer',
      skills: ['JavaScript', 'TypeScript', 'React'],
    },
    confidence: 1.0,
  });

  const bob = await graph.addNode({
    type: 'PERSON',
    label: 'Bob Smith',
    properties: {
      email: 'bob@example.com',
      age: 32,
      occupation: 'Product Manager',
      skills: ['Product Strategy', 'User Research'],
    },
    confidence: 1.0,
  });

  const carol = await graph.addNode({
    type: 'PERSON',
    label: 'Carol Davis',
    properties: {
      email: 'carol@example.com',
      age: 29,
      occupation: 'Data Scientist',
      skills: ['Python', 'Machine Learning', 'Statistics'],
    },
    confidence: 1.0,
  });

  const david = await graph.addNode({
    type: 'PERSON',
    label: 'David Wilson',
    properties: {
      email: 'david@example.com',
      age: 35,
      occupation: 'DevOps Engineer',
      skills: ['Docker', 'Kubernetes', 'AWS'],
    },
    confidence: 1.0,
  });

  // Add organizations
  const techCorp = await graph.addNode({
    type: 'ORGANIZATION',
    label: 'TechCorp Inc',
    properties: {
      industry: 'Technology',
      founded: 2015,
      employees: 500,
      location: 'San Francisco',
    },
    confidence: 1.0,
  });

  const dataCorp = await graph.addNode({
    type: 'ORGANIZATION',
    label: 'DataCorp Solutions',
    properties: {
      industry: 'Data Analytics',
      founded: 2018,
      employees: 200,
      location: 'New York',
    },
    confidence: 1.0,
  });

  // Add locations
  const sfOffice = await graph.addNode({
    type: 'LOCATION',
    label: 'San Francisco Office',
    properties: {
      address: '123 Tech Street, San Francisco, CA',
      type: 'office',
      capacity: 100,
    },
    confidence: 1.0,
  });

  const nyOffice = await graph.addNode({
    type: 'LOCATION',
    label: 'New York Office',
    properties: {
      address: '456 Data Ave, New York, NY',
      type: 'office',
      capacity: 50,
    },
    confidence: 1.0,
  });

  // Add skills
  const javascript = await graph.addNode({
    type: 'SKILL',
    label: 'JavaScript',
    properties: {
      category: 'Programming Language',
      popularity: 'High',
    },
    confidence: 1.0,
  });

  const python = await graph.addNode({
    type: 'SKILL',
    label: 'Python',
    properties: {
      category: 'Programming Language',
      popularity: 'High',
    },
    confidence: 1.0,
  });

  const machineLearning = await graph.addNode({
    type: 'SKILL',
    label: 'Machine Learning',
    properties: {
      category: 'Data Science',
      popularity: 'High',
    },
    confidence: 1.0,
  });

  // Create relationships
  await graph.addEdge({
    type: CommonEdgeType.EMPLOYED_BY,
    fromNodeId: alice.id,
    toNodeId: techCorp.id,
    properties: { since: '2020-01-15', position: 'Senior Software Engineer' },
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.EMPLOYED_BY,
    fromNodeId: bob.id,
    toNodeId: techCorp.id,
    properties: { since: '2019-06-01', position: 'Product Manager' },
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.EMPLOYED_BY,
    fromNodeId: carol.id,
    toNodeId: dataCorp.id,
    properties: { since: '2021-03-01', position: 'Senior Data Scientist' },
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.EMPLOYED_BY,
    fromNodeId: david.id,
    toNodeId: techCorp.id,
    properties: { since: '2018-09-01', position: 'Lead DevOps Engineer' },
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.COLLEAGUE_OF,
    fromNodeId: alice.id,
    toNodeId: bob.id,
    bidirectional: true,
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.COLLEAGUE_OF,
    fromNodeId: alice.id,
    toNodeId: david.id,
    bidirectional: true,
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.KNOWS,
    fromNodeId: alice.id,
    toNodeId: carol.id,
    properties: { since: '2020-05-01', context: 'University' },
    confidence: 0.8,
  });

  await graph.addEdge({
    type: CommonEdgeType.LOCATED_IN,
    fromNodeId: techCorp.id,
    toNodeId: sfOffice.id,
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.LOCATED_IN,
    fromNodeId: dataCorp.id,
    toNodeId: nyOffice.id,
    confidence: 1.0,
  });

  await graph.addEdge({
    type: CommonEdgeType.HAS_SKILL,
    fromNodeId: alice.id,
    toNodeId: javascript.id,
    properties: { level: 'Expert', years: 5 },
    confidence: 0.9,
  });

  await graph.addEdge({
    type: CommonEdgeType.HAS_SKILL,
    fromNodeId: carol.id,
    toNodeId: python.id,
    properties: { level: 'Expert', years: 4 },
    confidence: 0.9,
  });

  await graph.addEdge({
    type: CommonEdgeType.HAS_SKILL,
    fromNodeId: carol.id,
    toNodeId: machineLearning.id,
    properties: { level: 'Advanced', years: 3 },
    confidence: 0.85,
  });

  await graph.addEdge({
    type: CommonEdgeType.RELATED_TO,
    fromNodeId: javascript.id,
    toNodeId: python.id,
    properties: { relationship: 'Both are popular programming languages' },
    confidence: 0.7,
  });

  await graph.addEdge({
    type: CommonEdgeType.RELATED_TO,
    fromNodeId: python.id,
    toNodeId: machineLearning.id,
    properties: { relationship: 'Python is widely used for ML' },
    confidence: 0.9,
  });
}

// Initialize on server start
await initializeGraph();

// Bun server
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve the HTML file
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const file = Bun.file('./examples/visualization-demo.html');
      return new Response(file, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // API endpoints
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(url.pathname, req);
    }

    // 404 for other paths
    return new Response('Not Found', { status: 404 });
  },
});

async function handleAPI(pathname: string, req: Request) {
  if (!graph || !vizManager) {
    return new Response(JSON.stringify({ error: 'Graph not initialized' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (pathname) {
      case '/api/stats':
        const stats = await graph.getStats();
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/api/snapshot/all':
        // Get all node types and combine results
        const allNodes: any[] = [];
        const allEdges: any[] = [];

        // Query by each node type to get all nodes
        const nodeTypes = ['PERSON', 'ORGANIZATION', 'LOCATION', 'SKILL', 'DOCUMENT', 'CONCEPT', 'TOPIC', 'PRODUCT', 'SERVICE', 'FINANCIAL', 'GOAL', 'EVENT'];
        for (const type of nodeTypes) {
          const result = await graph.queryByType(type, { limit: 1000, includeEdges: true });
          allNodes.push(...result.nodes);
          allEdges.push(...result.edges);
        }

        const snapshot = await vizManager.snapshotCreator.createFromQueryResult(
          {
            nodes: allNodes,
            edges: allEdges,
            relevanceScore: 1.0,
          },
          {
            includeMetadata: true,
          }
        );
        return new Response(JSON.stringify(snapshot), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/api/snapshot/type':
        const url = new URL(req.url);
        const nodeType = url.searchParams.get('type') || 'PERSON';
        const typeSnapshot = await vizManager.snapshotCreator.createFromNodeTypes([nodeType], {
          includeMetadata: true,
        });
        return new Response(JSON.stringify(typeSnapshot), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/api/search':
        const searchUrl = new URL(req.url);
        const query = searchUrl.searchParams.get('q') || '';
        const searchResults = await graph.search({ query, limit: 20 });
        const searchSnapshot = await vizManager.snapshotCreator.createFromQueryResult(searchResults, {
          includeMetadata: true,
        });
        return new Response(JSON.stringify(searchSnapshot), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/api/node':
        const nodeUrl = new URL(req.url);
        const nodeId = nodeUrl.searchParams.get('id');
        const depth = parseInt(nodeUrl.searchParams.get('depth') || '2');
        if (!nodeId) {
          return new Response(JSON.stringify({ error: 'Node ID required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const nodeSnapshot = await vizManager.snapshotCreator.createFromNode(nodeId, depth, {
          includeMetadata: true,
        });
        return new Response(JSON.stringify(nodeSnapshot), {
          headers: { 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ error: 'Unknown API endpoint' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

console.log(`
🚀 Knowledge Graph Visualization Server
======================================
Server running at: http://localhost:${PORT}

Available endpoints:
- GET /                     - Visualization demo UI
- GET /api/stats           - Graph statistics
- GET /api/snapshot/all    - All nodes snapshot
- GET /api/snapshot/type   - Nodes by type (?type=PERSON)
- GET /api/search          - Search nodes (?q=engineer)
- GET /api/node            - Node neighborhood (?id=xxx&depth=2)

Open http://localhost:${PORT} in your browser to see the demo!
`);
