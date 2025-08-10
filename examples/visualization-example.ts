import { KnowledgeGraph, SQLiteAdapter, MermaidGraphVisualizer, MermaidUtils } from '../src';

/**
 * Comprehensive example demonstrating knowledge graph visualization with Mermaid
 *
 * This example shows how to:
 * - Create a knowledge graph with sample data
 * - Generate Mermaid diagrams from graph data
 * - Export visualizations in different formats
 * - Create interactive HTML visualizations
 */
async function main() {
  console.log('🚀 Knowledge Graph Visualization Example\n');

  // Create a knowledge graph
  const adapter = new SQLiteAdapter({
    connection: ':memory:', // Use in-memory database for this example
    debug: true,
  });
  const graph = new KnowledgeGraph(adapter);
  
  await graph.initialize();

  // Create Mermaid visualizer
  const visualizer = new MermaidGraphVisualizer(graph);

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

  // ============ Mermaid Visualization Examples ============
  console.log('\n=== Mermaid Visualization Examples ===');

  // Example 1: Visualize Alice's network
  console.log("\n1. Visualizing Alice's network (depth 2)...");

  const aliceDiagram = await visualizer.generateFromNode(alice.id, 2, {
    direction: 'TD',
    includeProperties: true,
    nodeTypeStyles: {
      PERSON: 'fill:#4CAF50,stroke:#333,stroke-width:2px',
      ORGANIZATION: 'fill:#2196F3,stroke:#333,stroke-width:2px',
      LOCATION: 'fill:#FF9800,stroke:#333,stroke-width:2px',
      SKILL: 'fill:#9C27B0,stroke:#333,stroke-width:2px',
    },
  });

  console.log('Generated Mermaid diagram:');
  console.log(aliceDiagram.content);
  console.log(`\nDiagram contains ${aliceDiagram.nodeCount} nodes and ${aliceDiagram.edgeCount} edges`);

  // Example 2: Search and visualize
  console.log('\n2. Searching for "engineer" and visualizing results...');

  const searchDiagram = await visualizer.generateFromSearch('engineer', {
    direction: 'LR',
    maxNodes: 10,
    includeProperties: false,
  });

  console.log('\nGenerated search results as Mermaid diagram');
  console.log(`Diagram contains ${searchDiagram.nodeCount} nodes and ${searchDiagram.edgeCount} edges`);

  // Example 3: Visualize by node types
  console.log('\n3. Visualizing all people and organizations...');

  const typesDiagram = await visualizer.generateFromNodeTypes(['PERSON', 'ORGANIZATION'], {
    direction: 'TB',
    includeProperties: true,
  });

  console.log(`\nGenerated diagram with ${typesDiagram.nodeCount} nodes and ${typesDiagram.edgeCount} edges`);

  // Example 4: Export to HTML
  console.log('\n4. Exporting visualization as HTML...');

  const htmlContent = MermaidUtils.wrapInHtml(aliceDiagram, {
    title: "Alice's Knowledge Network",
    theme: 'default',
  });

  console.log('Generated HTML visualization (first 500 chars):');
  console.log(htmlContent.substring(0, 500) + '...');

  // Save to file (in a real application)
  // await fs.writeFile('visualization.html', htmlContent);

  // Example 5: Generate Markdown
  console.log('\n5. Generating Markdown documentation...');

  const markdown = MermaidUtils.toMarkdown(typesDiagram, 'Organization Structure');
  console.log('\nGenerated Markdown:');
  console.log(markdown);

  // Example 6: Generate Live Editor URL
  console.log('\n6. Generating Mermaid Live Editor URL...');

  const liveEditorUrl = MermaidUtils.generateLiveEditorUrl(searchDiagram);
  console.log('\nOpen this URL to edit the diagram online:');
  console.log(liveEditorUrl.substring(0, 100) + '...');

  // ============ Mermaid Advantages ============
  console.log('\n=== Why Mermaid? ===');
  console.log('✅ No external dependencies for rendering (uses standard Mermaid.js)');
  console.log('✅ Lightweight and fast generation');
  console.log('✅ Works in any Markdown viewer (GitHub, GitLab, etc.)');
  console.log('✅ Easy to embed in documentation');
  console.log('✅ Can be edited with any text editor');
  console.log('✅ Version control friendly');
  console.log('✅ Supports multiple diagram types');
  console.log('✅ Accessible and SEO-friendly');

  // ============ Cleanup ============
  console.log('\n=== Cleanup ===');

  await graph.close();

  console.log('✅ Example completed successfully');
  console.log('\n📚 Next steps:');
  console.log('1. Generate Mermaid diagrams from your knowledge graph');
  console.log('2. Embed diagrams in Markdown documentation');
  console.log('3. Create interactive HTML visualizations');
  console.log('4. Use Mermaid Live Editor for online editing');
  console.log('5. Integrate with your documentation workflow');
}

// Run the example
main().catch(console.error);
