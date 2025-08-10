import { KnowledgeGraph, SQLiteAdapter, KnowledgeExtractor } from '../src';

// User-defined node types
enum MyNodeType {
  PERSON = 'PERSON',
  COMPANY = 'COMPANY',
  PROJECT = 'PROJECT',
  TECHNOLOGY = 'TECHNOLOGY',
}

// User-defined edge types
enum MyEdgeType {
  WORKS_FOR = 'WORKS_FOR',
  USES_TECH = 'USES_TECH',
  LEADS_PROJECT = 'LEADS_PROJECT',
  COLLABORATES_WITH = 'COLLABORATES_WITH',
}

async function main() {
  const adapter = new SQLiteAdapter({
    connection: ':memory:',
  });
  const graph = new KnowledgeGraph<MyNodeType>(adapter);
  
  await graph.initialize();

  const extractor = new KnowledgeExtractor(graph);

  // Add custom entity patterns for our domain
  extractor.addEntityPattern({
    pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Names like "John Smith"
    type: MyNodeType.PERSON,
    extractor: (match) => ({
      label: match[0],
      properties: {
        type: 'person_name',
        extracted: true,
      },
      confidence: 0.8,
    }),
  });

  extractor.addEntityPattern({
    pattern: /\b[A-Z][a-z]+(?: Inc| Corp| LLC| Ltd)\b/g, // Company names
    type: MyNodeType.COMPANY,
    extractor: (match) => ({
      label: match[0],
      properties: {
        type: 'company_name',
        extracted: true,
      },
      confidence: 0.9,
    }),
  });

  extractor.addEntityPattern({
    pattern: /\b(?:React|Angular|Vue|Node\.js|Python|Java|TypeScript)\b/gi, // Technologies
    type: MyNodeType.TECHNOLOGY,
    extractor: (match) => ({
      label: match[0],
      properties: {
        type: 'technology',
        category: 'programming_language_or_framework',
        extracted: true,
      },
      confidence: 0.95,
    }),
  });

  // Add custom relationship patterns
  extractor.addRelationshipPattern({
    pattern: /(\b[A-Z][a-z]+ [A-Z][a-z]+\b).*?(?:works for|employed by|at)\s+(\b[A-Z][a-z]+(?: Inc| Corp| LLC| Ltd)\b)/gi,
    type: MyEdgeType.WORKS_FOR,
    extractor: (match, _nodes) => {
      const personName = match[1];
      const companyName = match[2];

      return {
        fromNodeLabel: personName,
        toNodeLabel: companyName,
        properties: {
          context: 'employment_relationship',
          sentence: match[0],
          extracted: true,
        },
        confidence: 0.8,
      };
    },
  });

  extractor.addRelationshipPattern({
    pattern: /(\b[A-Z][a-z]+(?: Inc| Corp| LLC| Ltd)\b).*?(?:uses|implements|adopts)\s+(\b(?:React|Angular|Vue|Node\.js|Python|Java|TypeScript)\b)/gi,
    type: MyEdgeType.USES_TECH,
    extractor: (match, _nodes) => {
      const companyName = match[1];
      const technology = match[2];

      return {
        fromNodeLabel: companyName,
        toNodeLabel: technology,
        properties: {
          context: 'technology_adoption',
          sentence: match[0],
          extracted: true,
        },
        confidence: 0.7,
      };
    },
  });

  // Extract from text using our custom patterns
  const text = `
    John Smith works for TechCorp Inc as a senior developer. 
    TechCorp Inc uses React and TypeScript for their frontend development.
    Sarah Johnson is employed by DataCorp LLC and they use Python for data analysis.
    Both companies collaborate on the AI Project.
  `;

  const extraction = await extractor.extractFromText(text, {
    extractEntities: true,
    extractRelationships: true,
    minConfidence: 0.5,
  });

  console.log('📊 Custom Extraction Results:');
  console.log(`\nEntities found (${extraction.nodes.length}):`);
  for (const node of extraction.nodes) {
    console.log(`  - ${node.label} (${node.type}) - confidence: ${node.confidence}`);
  }

  console.log(`\nRelationships found (${extraction.edges.length}):`);
  for (const edge of extraction.edges) {
    console.log(`  - ${edge.fromNodeLabel} -> ${edge.type} -> ${edge.toNodeLabel} - confidence: ${edge.confidence}`);
  }

  // Process and add to graph
  const { nodesAdded, edgesAdded } = await extractor.processExtractedKnowledge(extraction, {
    mergeStrategy: 'merge',
    sessionId: 'custom-extraction-demo',
  });

  console.log(`\n✅ Added to graph: ${nodesAdded} nodes, ${edgesAdded} edges`);

  // Query the results
  const people = await graph.queryByType(MyNodeType.PERSON);
  const companies = await graph.queryByType(MyNodeType.COMPANY);
  const technologies = await graph.queryByType(MyNodeType.TECHNOLOGY);

  console.log(`\n📈 Graph Statistics:`);
  console.log(`  - People: ${people.nodes.length}`);
  console.log(`  - Companies: ${companies.nodes.length}`);
  console.log(`  - Technologies: ${technologies.nodes.length}`);

  await graph.close();
}

main().catch(console.error);
