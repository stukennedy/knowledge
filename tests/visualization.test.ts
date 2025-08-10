import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraph, SQLiteAdapter, MermaidGraphVisualizer, MermaidUtils, CommonEdgeType } from '../src';

describe('Mermaid Visualization Tests', () => {
  let graph: KnowledgeGraph;
  let visualizer: MermaidGraphVisualizer;

  beforeEach(async () => {
    const adapter = new SQLiteAdapter({ connection: ':memory:' });
    graph = new KnowledgeGraph(adapter);
    await graph.initialize();
    visualizer = new MermaidGraphVisualizer(graph);

    // Create sample data
    const alice = await graph.addNode({
      type: 'PERSON',
      label: 'Alice Johnson',
      properties: { email: 'alice@example.com', age: 28 },
      confidence: 1.0,
    });

    const bob = await graph.addNode({
      type: 'PERSON',
      label: 'Bob Smith',
      properties: { email: 'bob@example.com', age: 32 },
      confidence: 1.0,
    });

    const techCorp = await graph.addNode({
      type: 'ORGANIZATION',
      label: 'TechCorp Inc',
      properties: { industry: 'Technology', employees: 500 },
      confidence: 1.0,
    });

    const office = await graph.addNode({
      type: 'LOCATION',
      label: 'Main Office',
      properties: { address: '123 Tech St', capacity: 100 },
      confidence: 1.0,
    });

    await graph.addEdge({
      type: CommonEdgeType.EMPLOYED_BY,
      fromNodeId: alice.id,
      toNodeId: techCorp.id,
      properties: { position: 'Engineer' },
      confidence: 1.0,
    });

    await graph.addEdge({
      type: CommonEdgeType.EMPLOYED_BY,
      fromNodeId: bob.id,
      toNodeId: techCorp.id,
      properties: { position: 'Manager' },
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
      type: CommonEdgeType.LOCATED_IN,
      fromNodeId: techCorp.id,
      toNodeId: office.id,
      confidence: 1.0,
    });
  });

  afterEach(async () => {
    await graph.close();
  });

  describe('Diagram Generation', () => {
    it('should generate a diagram from query result', async () => {
      const queryResult = await graph.search({ query: 'Tech', limit: 10 });
      const diagram = visualizer.generateFromQueryResult(queryResult);

      expect(diagram).toBeDefined();
      expect(diagram.type).toBe('graph');
      expect(diagram.direction).toBe('TD');
      expect(diagram.content).toContain('graph TD');
      expect(diagram.nodeCount).toBeGreaterThan(0);
    });

    it('should generate a diagram from a specific node', async () => {
      const nodes = await graph.findNodesByLabel('Alice');
      const aliceId = nodes[0].id;

      const diagram = await visualizer.generateFromNode(aliceId, 2);

      expect(diagram).toBeDefined();
      expect(diagram.content).toContain('PERSON: Alice Johnson');
      expect(diagram.content).toContain('ORGANIZATION: TechCorp Inc');
      expect(diagram.nodeCount).toBeGreaterThanOrEqual(3);
    });

    it('should generate a diagram from search', async () => {
      const diagram = await visualizer.generateFromSearch('Smith');

      expect(diagram).toBeDefined();
      expect(diagram.content).toContain('Bob Smith');
      expect(diagram.nodeCount).toBeGreaterThanOrEqual(1);
    });

    it('should generate a diagram for specific node types', async () => {
      const diagram = await visualizer.generateFromNodeTypes(['PERSON', 'ORGANIZATION']);

      expect(diagram).toBeDefined();
      expect(diagram.content).toContain('PERSON:');
      expect(diagram.content).toContain('ORGANIZATION:');
      expect(diagram.nodeCount).toBeGreaterThanOrEqual(3);
    });

    it('should respect maxNodes option', async () => {
      // Add more nodes
      for (let i = 0; i < 10; i++) {
        await graph.addNode({
          type: 'PERSON',
          label: `Person ${i}`,
        });
      }

      const diagram = await visualizer.generateFromNodeTypes(['PERSON'], {
        maxNodes: 5,
      });

      expect(diagram.nodeCount).toBeLessThanOrEqual(5);
    });

    it('should include properties when requested', async () => {
      const queryResult = await graph.search({ query: 'Alice', limit: 10 });
      const diagram = visualizer.generateFromQueryResult(queryResult, {
        includeProperties: true,
      });

      expect(diagram.content).toContain('email:');
      expect(diagram.content).toContain('age:');
    });

    it('should apply custom node styles', async () => {
      const queryResult = await graph.search({ query: 'Alice', limit: 10 });
      const diagram = visualizer.generateFromQueryResult(queryResult, {
        nodeTypeStyles: {
          PERSON: 'fill:#ff0000,stroke:#000,stroke-width:3px',
        },
      });

      expect(diagram.content).toContain('fill:#ff0000');
    });

    it('should handle bidirectional edges', async () => {
      const queryResult = await graph.queryByType('PERSON', { includeEdges: true });
      const diagram = visualizer.generateFromQueryResult(queryResult);

      // Bidirectional edges are rendered as two separate arrows in Mermaid
      expect(diagram.content).toContain('-->'); // Should have arrow
      expect(diagram.content).toContain('colleague of'); // Should have the edge type
    });

    it('should sanitize node IDs properly', async () => {
      const node = await graph.addNode({
        type: 'DOCUMENT',
        label: 'Test-Doc/2024',
      });

      const diagram = await visualizer.generateFromNode(node.id, 1);
      
      // Should have sanitized the node ID (replaced problematic chars with underscores)
      expect(diagram.content).toMatch(/[a-zA-Z0-9_]+\[/); // ID should only have safe chars
    });

    it('should escape labels properly', async () => {
      const node = await graph.addNode({
        type: 'DOCUMENT',
        label: 'Test "Doc" <with> special\'s',
      });

      const diagram = await visualizer.generateFromNode(node.id, 1);
      
      expect(diagram.content).toContain('&quot;');
      expect(diagram.content).toContain('&lt;');
      expect(diagram.content).toContain('&gt;');
      expect(diagram.content).toContain('&apos;');
    });
  });

  describe('Mermaid Utils', () => {
    it('should wrap diagram in HTML', async () => {
      const diagram = await visualizer.generateFromNodeTypes(['PERSON']);
      const html = MermaidUtils.wrapInHtml(diagram, {
        title: 'Test Graph',
        theme: 'dark',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test Graph</title>');
      expect(html).toContain('theme: \'dark\'');
      expect(html).toContain('class="mermaid"');
      expect(html).toContain(diagram.content);
    });

    it('should generate Live Editor URL', async () => {
      const diagram = await visualizer.generateFromNodeTypes(['PERSON']);
      const url = MermaidUtils.generateLiveEditorUrl(diagram);

      expect(url).toContain('https://mermaid.live/edit#');
      expect(url).toContain('pako:');
    });

    it('should convert to Markdown', async () => {
      const diagram = await visualizer.generateFromNodeTypes(['PERSON']);
      const markdown = MermaidUtils.toMarkdown(diagram, 'People Network');

      expect(markdown).toContain('# People Network');
      expect(markdown).toContain('```mermaid');
      expect(markdown).toContain(diagram.content);
      expect(markdown).toContain('```');
      expect(markdown).toContain('**Graph Statistics:**');
    });
  });

  describe('Backward Compatibility', () => {
    it('should export GraphVisualizationManager alias', async () => {
      expect(MermaidGraphVisualizer).toBeDefined();
      // GraphVisualizationManager should be an alias for MermaidGraphVisualizer
      const vizModule = await import('../src/visualization/index');
      expect(vizModule.GraphVisualizationManager).toBe(MermaidGraphVisualizer);
    });
  });
});