import { createKnowledgeGraph } from '../src';

// User-defined node types
enum MyNodeType {
  PERSON = 'PERSON',
  COMPANY = 'COMPANY',
  PROJECT = 'PROJECT',
  SKILL = 'SKILL',
}

// User-defined edge types
enum MyEdgeType {
  WORKS_FOR = 'WORKS_FOR',
  MANAGES = 'MANAGES',
  HAS_SKILL = 'HAS_SKILL',
  COLLABORATES_ON = 'COLLABORATES_ON',
}

async function main() {
  // Create a knowledge graph with custom types
  const graph = createKnowledgeGraph<MyNodeType, MyEdgeType>('sqlite', {
    connection: ':memory:',
  });

  await graph.initialize();

  // Now we have full type safety with our custom types
  const person = await graph.addNode({
    type: MyNodeType.PERSON, // TypeScript will enforce this
    label: 'Alice Johnson',
    properties: {
      email: 'alice@example.com',
      age: 28,
    },
  });

  const company = await graph.addNode({
    type: MyNodeType.COMPANY, // TypeScript will enforce this
    label: 'TechCorp',
    properties: {
      industry: 'Technology',
      founded: 2015,
    },
  });

  // Create relationships with type safety
  await graph.addEdge({
    type: MyEdgeType.WORKS_FOR, // TypeScript will enforce this
    fromNodeId: person.id,
    toNodeId: company.id,
    properties: {
      since: '2020-01-15',
      position: 'Software Engineer',
    },
  });

  // Query with type safety
  const people = await graph.queryByType(MyNodeType.PERSON);

  console.log('✅ Custom types working with full type safety!');
  console.log(`Found ${people.nodes.length} people`);

  await graph.close();
}

main().catch(console.error);
