import { createKnowledgeGraph, GraphVisualizationManager, PerformanceUtils, ColorUtils, LayoutUtils, type VisualizationBackend } from '../src';

/**
 * Comprehensive example demonstrating knowledge graph visualization
 *
 * This example shows how to:
 * - Create a knowledge graph with sample data
 * - Visualize the graph using different backends
 * - Handle interactions and events
 * - Export visualizations
 * - Optimize performance for large graphs
 */
async function main() {
  console.log('🚀 Knowledge Graph Visualization Example\n');

  // Create a knowledge graph
  const graph = createKnowledgeGraph('sqlite', {
    connection: ':memory:', // Use in-memory database for this example
    debug: true,
  });

  await graph.initialize();

  // Create visualization manager
  const vizManager = new GraphVisualizationManager(graph);

  // ============ Create Sample Data ============
  console.log('=== Creating Sample Data ===');

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

  // Add skills/concepts
  const javascript = await graph.addNode({
    type: 'SKILL',
    label: 'JavaScript',
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
    type: 'EMPLOYED_BY',
    fromNodeId: alice.id,
    toNodeId: techCorp.id,
    properties: {
      since: '2020-01-15',
      position: 'Senior Software Engineer',
    },
    confidence: 1.0,
  });

  await graph.addEdge({
    type: 'EMPLOYED_BY',
    fromNodeId: bob.id,
    toNodeId: techCorp.id,
    properties: {
      since: '2019-06-01',
      position: 'Product Manager',
    },
    confidence: 1.0,
  });

  await graph.addEdge({
    type: 'EMPLOYED_BY',
    fromNodeId: carol.id,
    toNodeId: dataCorp.id,
    properties: {
      since: '2021-03-01',
      position: 'Senior Data Scientist',
    },
    confidence: 1.0,
  });

  await graph.addEdge({
    type: 'COLLEAGUE_OF',
    fromNodeId: alice.id,
    toNodeId: bob.id,
    bidirectional: true,
    confidence: 1.0,
  });

  await graph.addEdge({
    type: 'KNOWS',
    fromNodeId: alice.id,
    toNodeId: carol.id,
    properties: {
      since: '2020-05-01',
      context: 'University',
    },
    confidence: 0.8,
  });

  await graph.addEdge({
    type: 'LOCATED_IN',
    fromNodeId: techCorp.id,
    toNodeId: sfOffice.id,
    confidence: 1.0,
  });

  await graph.addEdge({
    type: 'LOCATED_IN',
    fromNodeId: dataCorp.id,
    toNodeId: nyOffice.id,
    confidence: 1.0,
  });

  await graph.addEdge({
    type: 'HAS_SKILL',
    fromNodeId: alice.id,
    toNodeId: javascript.id,
    properties: {
      level: 'Expert',
      years: 5,
    },
    confidence: 0.9,
  });

  await graph.addEdge({
    type: 'HAS_SKILL',
    fromNodeId: carol.id,
    toNodeId: machineLearning.id,
    properties: {
      level: 'Expert',
      years: 4,
    },
    confidence: 0.9,
  });

  await graph.addEdge({
    type: 'RELATED_TO',
    fromNodeId: javascript.id,
    toNodeId: machineLearning.id,
    properties: {
      relationship: 'Both are popular in tech industry',
    },
    confidence: 0.6,
  });

  console.log('✅ Sample data created successfully\n');

  // ============ Get Graph Statistics ============
  console.log('=== Graph Statistics ===');

  const stats = await graph.getStats();
  console.log(`Total nodes: ${stats.nodeCount}`);
  console.log(`Total edges: ${stats.edgeCount}`);
  console.log(`Average degree: ${stats.averageDegree.toFixed(2)}`);
  console.log(`Graph density: ${stats.density.toFixed(4)}`);

  console.log('\nNodes by type:');
  Object.entries(stats.nodesByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  console.log('\nEdges by type:');
  Object.entries(stats.edgesByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  // ============ Visualization Examples ============
  console.log('\n=== Visualization Examples ===');

  // Note: In a real browser environment, you would create an HTML container
  // and pass it to the visualization manager. For this example, we'll
  // demonstrate the API without actual rendering.

  // Example 1: Visualize Alice's network
  console.log("\n1. Visualizing Alice's network (depth 2)...");

  // In a real application, you would do:
  /*
  const container = document.getElementById('graph-container');
  await vizManager.initializeVisualization('d3', container, {
    visualization: {
      layout: 'force',
      nodeColors: ColorUtils.generateNodeColorPalette(Object.keys(stats.nodesByType)),
      edgeColors: ColorUtils.generateEdgeColorPalette(Object.keys(stats.edgesByType)),
    },
    events: {
      onNodeClick: (node, event) => {
        console.log('Clicked node:', node.label);
      },
      onEdgeClick: (edge, event) => {
        console.log('Clicked edge:', edge.type);
      },
    },
  });
  
  await vizManager.visualizeNode(alice.id, 2, {
    includeMetadata: true,
    transformOptions: {
      nodeColorMapping: {
        PERSON: '#4CAF50',
        ORGANIZATION: '#2196F3',
        LOCATION: '#FF9800',
        SKILL: '#9C27B0',
      },
    },
  });
  */

  // Example 2: Search and visualize
  console.log('\n2. Searching for "engineer" and visualizing results...');

  const searchResults = await graph.search({
    query: 'engineer',
    limit: 10,
  });

  console.log(`Found ${searchResults.nodes.length} nodes matching "engineer"`);
  searchResults.nodes.forEach((node) => {
    console.log(`  - ${node.label} (${node.type})`);
  });

  // Example 3: Visualize by node types
  console.log('\n3. Visualizing all people and organizations...');

  const peopleAndOrgs = await vizManager.snapshotCreator.createFromNodeTypes(['PERSON', 'ORGANIZATION'], { includeMetadata: true });

  console.log(`Created snapshot with ${peopleAndOrgs.nodes.length} nodes and ${peopleAndOrgs.edges.length} edges`);

  // Example 4: Performance optimization
  console.log('\n4. Performance optimization example...');

  const isRealTime = PerformanceUtils.isSuitableForRealTime(stats.nodeCount, stats.edgeCount);
  const recommendedBackend = PerformanceUtils.getRecommendedBackend(stats.nodeCount, stats.edgeCount);

  console.log(`Graph suitable for real-time visualization: ${isRealTime}`);
  console.log(`Recommended backend: ${recommendedBackend}`);

  // Example 5: Layout optimization
  console.log('\n5. Layout optimization...');

  const layoutOptions = LayoutUtils.getLayoutOptionsForGraphSize(stats.nodeCount, stats.edgeCount);
  const nodeSizes = LayoutUtils.calculateOptimalNodeSizes(stats.nodesByType, stats.nodeCount);
  const edgeWidths = LayoutUtils.calculateOptimalEdgeWidths(stats.edgesByType, stats.edgeCount);

  console.log('Layout options:', layoutOptions);
  console.log('Optimal node sizes:', nodeSizes);
  console.log('Optimal edge widths:', edgeWidths);

  // Example 6: Color utilities
  console.log('\n6. Color utilities...');

  const nodeColors = ColorUtils.generateNodeColorPalette(Object.keys(stats.nodesByType));
  const edgeColors = ColorUtils.generateEdgeColorPalette(Object.keys(stats.edgesByType));

  console.log('Node color palette:', nodeColors);
  console.log('Edge color palette:', edgeColors);

  // Example 7: Export functionality (demonstration)
  console.log('\n7. Export functionality...');

  // In a real application, you would do:
  /*
  const imageData = await vizManager.exportImage('png', {
    quality: 0.9,
    maxWidth: 1920,
    maxHeight: 1080,
  });
  
  // Create download link
  const link = document.createElement('a');
  link.href = imageData;
  link.download = 'knowledge-graph.png';
  link.click();
  */

  console.log('Export functionality would save the visualization as an image');

  // ============ Different Backend Examples ============
  console.log('\n=== Backend Comparison ===');

  const backends: VisualizationBackend[] = ['d3', 'vis-network', 'cytoscape', 'three'];

  backends.forEach((backend) => {
    const isRecommended = backend === recommendedBackend;
    console.log(`${backend.toUpperCase()}${isRecommended ? ' (RECOMMENDED)' : ''}:`);

    switch (backend) {
      case 'd3':
        console.log('  - Most customizable and flexible');
        console.log('  - Best for custom styling and interactions');
        console.log('  - Good for small to medium graphs');
        console.log('  - Requires more setup but offers full control');
        break;
      case 'vis-network':
        console.log('  - Excellent performance and features');
        console.log('  - Built-in physics simulation');
        console.log('  - Good for medium to large graphs');
        console.log('  - Easy to use with good defaults');
        break;
      case 'cytoscape':
        console.log('  - Professional-grade graph visualization');
        console.log('  - Extensive layout algorithms');
        console.log('  - Advanced styling and analysis');
        console.log('  - Best for complex graph analysis');
        break;
      case 'three':
        console.log('  - 3D visualization capabilities');
        console.log('  - Immersive experience');
        console.log('  - Good for spatial relationships');
        console.log('  - More resource intensive');
        break;
    }
    console.log('');
  });

  // ============ Cleanup ============
  console.log('=== Cleanup ===');

  vizManager.destroyVisualization();
  await graph.close();

  console.log('✅ Example completed successfully');
  console.log('\n📚 Next steps:');
  console.log('1. Create an HTML container element');
  console.log('2. Initialize the visualization manager with your preferred backend');
  console.log('3. Call visualization methods to render your graph');
  console.log('4. Add event handlers for interactivity');
  console.log('5. Use export functionality to save visualizations');
}

// Run the example
main().catch(console.error);
