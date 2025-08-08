import { createKnowledgeGraph, CommonEdgeType, KnowledgeExtractor } from '../src';

async function main() {
  // Create a knowledge graph with SQLite backend
  const graph = await createKnowledgeGraph('sqlite', {
    connection: './knowledge.db', // Use ':memory:' for in-memory database
    debug: true,
  });
  
  await graph.initialize();
  
  console.log('📊 Knowledge Graph initialized\n');
  
  // ============ Basic Node and Edge Operations ============
  console.log('=== Creating Nodes ===');
  
  // Add some people
  const alice = await graph.addNode({
    type: 'PERSON',
    label: 'Alice Johnson',
    properties: {
      email: 'alice@example.com',
      age: 28,
      occupation: 'Software Engineer',
    },
    confidence: 1.0,
  });
  console.log(`✅ Created person: ${alice.label}`);
  
  const bob = await graph.addNode({
    type: 'PERSON',
    label: 'Bob Smith',
    properties: {
      email: 'bob@example.com',
      age: 32,
      occupation: 'Product Manager',
    },
    confidence: 1.0,
  });
  console.log(`✅ Created person: ${bob.label}`);
  
  // Add a company
  const techCorp = await graph.addNode({
    type: 'ORGANIZATION',
    label: 'TechCorp Inc',
    properties: {
      industry: 'Technology',
      founded: 2015,
      employees: 500,
    },
    confidence: 1.0,
  });
  console.log(`✅ Created organization: ${techCorp.label}`);
  
  // Add a location
  const office = await graph.addNode({
    type: 'LOCATION',
    label: 'TechCorp HQ',
    properties: {
      address: '123 Tech Street, San Francisco, CA',
      type: 'office',
    },
    confidence: 1.0,
  });
  console.log(`✅ Created location: ${office.label}`);
  
  console.log('\n=== Creating Relationships ===');
  
  // Create relationships
  await graph.addEdge({
    type: CommonEdgeType.EMPLOYED_BY,
    fromNodeId: alice.id,
    toNodeId: techCorp.id,
    properties: {
      since: '2020-01-15',
      position: 'Senior Software Engineer',
    },
  });
  console.log(`✅ ${alice.label} -> EMPLOYED_BY -> ${techCorp.label}`);
  
  await graph.addEdge({
    type: CommonEdgeType.EMPLOYED_BY,
    fromNodeId: bob.id,
    toNodeId: techCorp.id,
    properties: {
      since: '2019-06-01',
      position: 'Product Manager',
    },
  });
  console.log(`✅ ${bob.label} -> EMPLOYED_BY -> ${techCorp.label}`);
  
  await graph.addEdge({
    type: CommonEdgeType.COLLEAGUE_OF,
    fromNodeId: alice.id,
    toNodeId: bob.id,
    bidirectional: true, // Creates edges in both directions
  });
  console.log(`✅ ${alice.label} <-> COLLEAGUE_OF <-> ${bob.label}`);
  
  await graph.addEdge({
    type: CommonEdgeType.LOCATED_IN,
    fromNodeId: techCorp.id,
    toNodeId: office.id,
  });
  console.log(`✅ ${techCorp.label} -> LOCATED_IN -> ${office.label}`);
  
  // ============ Querying the Graph ============
  console.log('\n=== Querying the Graph ===');
  
  // Query by type
  const allPeople = await graph.queryByType('PERSON');
  console.log(`\nFound ${allPeople.nodes.length} people:`);
  for (const person of allPeople.nodes) {
    console.log(`  - ${person.label} (${person.properties.occupation})`);
  }
  
  // Query related nodes
  const aliceNetwork = await graph.queryRelated(alice.id, {
    depth: 2,
    includeEdges: true,
  });
  console.log(`\nAlice's network (depth 2):`);
  console.log(`  - ${aliceNetwork.nodes.length} nodes`);
  console.log(`  - ${aliceNetwork.edges.length} edges`);
  
  // Find shortest path
  const path = await graph.findShortestPath(alice.id, office.id);
  if (path) {
    console.log(`\nShortest path from ${alice.label} to ${office.label}:`);
    console.log(`  Path length: ${path.length}`);
    console.log(`  Nodes: ${path.nodes.map(n => n.label).join(' -> ')}`);
  }
  
  // ============ Knowledge Extraction ============
  console.log('\n=== Knowledge Extraction ===');
  
  const extractor = new KnowledgeExtractor(graph);
  
  // Extract from text
  const text = `
    Carol Davis is a Data Scientist at TechCorp Inc. She joined the company in 2021
    and works closely with Alice Johnson on machine learning projects. Carol has a
    PhD from Stanford University and specializes in natural language processing.
    Her email is carol.davis@techcorp.com and she can be reached at +1-555-0123.
    She recently published a paper on knowledge graphs that costs $29.99.
  `;
  
  const extraction = await extractor.extractFromText(text, {
    extractEntities: true,
    extractRelationships: true,
    minConfidence: 0.5,
  });
  
  console.log(`\nExtracted from text:`);
  console.log(`  - ${extraction.nodes.length} entities`);
  console.log(`  - ${extraction.edges.length} relationships`);
  console.log(`  - Overall confidence: ${extraction.confidence.toFixed(2)}`);
  
  // Process the extracted knowledge
  const { nodesAdded, edgesAdded } = await extractor.processExtractedKnowledge(
    extraction,
    {
      mergeStrategy: 'merge',
      sessionId: 'example-session',
    }
  );
  
  console.log(`\nAdded to graph:`);
  console.log(`  - ${nodesAdded} new nodes`);
  console.log(`  - ${edgesAdded} new edges`);
  
  // Extract from conversation
  const conversation = [
    { role: 'user', content: 'I need to schedule a meeting with David Brown from Marketing.' },
    { role: 'assistant', content: 'I can help you schedule a meeting with David Brown.' },
    { role: 'user', content: 'He works in the New York office and handles social media campaigns.' },
    { role: 'assistant', content: 'Got it. David Brown from Marketing in the New York office.' },
  ];
  
  const conversationExtraction = await extractor.extractFromConversation(conversation, {
    extractEntities: true,
    extractTopics: true,
  });
  
  console.log(`\nExtracted from conversation:`);
  console.log(`  - ${conversationExtraction.nodes.length} entities`);
  console.log(`  - Topics: ${conversationExtraction.metadata?.topics?.join(', ') || 'none'}`);
  
  // ============ Graph Statistics ============
  console.log('\n=== Graph Statistics ===');
  
  const stats = await graph.getStats();
  console.log(`\nGraph statistics:`);
  console.log(`  - Total nodes: ${stats.nodeCount}`);
  console.log(`  - Total edges: ${stats.edgeCount}`);
  console.log(`  - Average degree: ${stats.averageDegree.toFixed(2)}`);
  console.log(`  - Graph density: ${stats.density.toFixed(4)}`);
  console.log(`\nNodes by type:`);
  for (const [type, count] of Object.entries(stats.nodesByType)) {
    console.log(`  - ${type}: ${count}`);
  }
  
  // ============ Search ============
  console.log('\n=== Search Operations ===');
  
  const searchResults = await graph.search({
    query: 'engineer tech',
    limit: 5,
  });
  
  console.log(`\nSearch results for "engineer tech":`);
  for (const node of searchResults.nodes) {
    console.log(`  - ${node.label} (${node.type})`);
  }
  
  // ============ Cleanup ============
  await graph.close();
  console.log('\n✨ Knowledge Graph closed');
}

// Run the example
main().catch(console.error);