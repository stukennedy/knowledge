import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraph, SQLiteAdapter, CommonEdgeType } from '../src';

describe('KnowledgeGraph Basic Tests', () => {
  let graph: KnowledgeGraph;

  beforeEach(async () => {
    const adapter = new SQLiteAdapter({ connection: ':memory:' });
    graph = new KnowledgeGraph(adapter);
    await graph.initialize();
  });

  afterEach(async () => {
    await graph.close();
  });

  describe('Node Operations', () => {
    it('should add a node', async () => {
      const node = await graph.addNode({
        type: 'PERSON',
        label: 'John Doe',
        properties: { email: 'john@example.com' },
        confidence: 0.9,
      });

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.type).toBe('PERSON');
      expect(node.label).toBe('John Doe');
      expect(node.properties.email).toBe('john@example.com');
      expect(node.confidence).toBe(0.9);
    });

    it('should get a node by ID', async () => {
      const created = await graph.addNode({
        type: 'ORGANIZATION',
        label: 'Acme Corp',
      });

      const retrieved = await graph.getNode(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.label).toBe('Acme Corp');
    });

    it('should update a node', async () => {
      const node = await graph.addNode({
        type: 'PERSON',
        label: 'Jane Doe',
        properties: { age: 25 },
      });

      const updated = await graph.updateNode(node.id, {
        properties: { age: 26, city: 'New York' },
      });

      expect(updated).toBeDefined();
      expect(updated?.properties.age).toBe(26);
      expect(updated?.properties.city).toBe('New York');
    });

    it('should delete a node', async () => {
      const node = await graph.addNode({
        type: 'LOCATION',
        label: 'Test Location',
      });

      const deleted = await graph.deleteNode(node.id);
      expect(deleted).toBe(true);

      const retrieved = await graph.getNode(node.id);
      expect(retrieved).toBeNull();
    });

    it('should find nodes by label', async () => {
      await graph.addNode({
        type: 'PERSON',
        label: 'Alice Smith',
      });

      await graph.addNode({
        type: 'PERSON',
        label: 'Bob Smith',
      });

      const results = await graph.findNodesByLabel('Smith');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Operations', () => {
    it('should add an edge between nodes', async () => {
      const person = await graph.addNode({
        type: 'PERSON',
        label: 'Employee',
      });

      const company = await graph.addNode({
        type: 'ORGANIZATION',
        label: 'Company',
      });

      const edge = await graph.addEdge({
        type: CommonEdgeType.EMPLOYED_BY,
        fromNodeId: person.id,
        toNodeId: company.id,
        properties: { since: '2020' },
      });

      expect(edge).toBeDefined();
      expect(edge.type).toBe(CommonEdgeType.EMPLOYED_BY);
      expect(edge.fromNodeId).toBe(person.id);
      expect(edge.toNodeId).toBe(company.id);
      expect(edge.properties.since).toBe('2020');
    });

    it('should get edges between nodes', async () => {
      const node1 = await graph.addNode({
        type: 'PERSON',
        label: 'Person 1',
      });

      const node2 = await graph.addNode({
        type: 'PERSON',
        label: 'Person 2',
      });

      await graph.addEdge({
        type: CommonEdgeType.KNOWS,
        fromNodeId: node1.id,
        toNodeId: node2.id,
      });

      const edges = await graph.getEdgesBetween(node1.id, node2.id);
      expect(edges.length).toBe(1);
      expect(edges[0].type).toBe(CommonEdgeType.KNOWS);
    });

    it('should create bidirectional edges', async () => {
      const node1 = await graph.addNode({
        type: 'PERSON',
        label: 'Friend 1',
      });

      const node2 = await graph.addNode({
        type: 'PERSON',
        label: 'Friend 2',
      });

      await graph.addEdge({
        type: CommonEdgeType.FRIEND_OF,
        fromNodeId: node1.id,
        toNodeId: node2.id,
        bidirectional: true,
      });

      const edges1to2 = await graph.getEdgesBetween(node1.id, node2.id);
      const edges2to1 = await graph.getEdgesBetween(node2.id, node1.id);

      expect(edges1to2.length).toBe(1);
      expect(edges2to1.length).toBe(1);
    });
  });

  describe('Query Operations', () => {
    it('should query nodes by type', async () => {
      await graph.addNode({
        type: 'DOCUMENT',
        label: 'Document 1',
      });

      await graph.addNode({
        type: 'DOCUMENT',
        label: 'Document 2',
      });

      await graph.addNode({
        type: 'PERSON',
        label: 'Person 1',
      });

      const result = await graph.queryByType('DOCUMENT');
      expect(result.nodes.length).toBe(2);
      expect(result.nodes.every((n) => n.type === 'DOCUMENT')).toBe(true);
    });

    it('should query related nodes', async () => {
      const center = await graph.addNode({
        type: 'PERSON',
        label: 'Center Person',
      });

      const related1 = await graph.addNode({
        type: 'PERSON',
        label: 'Related 1',
      });

      const related2 = await graph.addNode({
        type: 'PERSON',
        label: 'Related 2',
      });

      await graph.addEdge({
        type: CommonEdgeType.KNOWS,
        fromNodeId: center.id,
        toNodeId: related1.id,
      });

      await graph.addEdge({
        type: CommonEdgeType.KNOWS,
        fromNodeId: center.id,
        toNodeId: related2.id,
      });

      const result = await graph.queryRelated(center.id, { depth: 1 });
      expect(result.nodes.length).toBe(3); // center + 2 related
      expect(result.edges.length).toBe(2);
    });
  });

  describe('Search Operations', () => {
    it('should search nodes by text', async () => {
      await graph.addNode({
        type: 'DOCUMENT',
        label: 'Important Report',
        properties: { content: 'This is a very important document' },
      });

      await graph.addNode({
        type: 'DOCUMENT',
        label: 'Another Document',
        properties: { content: 'This is another document' },
      });

      const result = await graph.search({ query: 'important' });
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.nodes[0].label).toContain('Important');
    });
  });

  describe('Path Finding', () => {
    it('should find shortest path between nodes', async () => {
      const start = await graph.addNode({
        type: 'PERSON',
        label: 'Start',
      });

      const middle = await graph.addNode({
        type: 'PERSON',
        label: 'Middle',
      });

      const end = await graph.addNode({
        type: 'PERSON',
        label: 'End',
      });

      await graph.addEdge({
        type: CommonEdgeType.KNOWS,
        fromNodeId: start.id,
        toNodeId: middle.id,
      });

      await graph.addEdge({
        type: CommonEdgeType.KNOWS,
        fromNodeId: middle.id,
        toNodeId: end.id,
      });

      const path = await graph.findShortestPath(start.id, end.id);
      expect(path).toBeDefined();
      expect(path?.nodes.length).toBe(3);
      expect(path?.edges.length).toBe(2);
      expect(path?.length).toBe(2);
    });
  });

  describe('Batch Operations', () => {
    it('should batch add nodes', async () => {
      const result = await graph.batchAddNodes([
        {
          type: 'PERSON',
          label: 'Person 1',
        },
        {
          type: 'PERSON',
          label: 'Person 2',
        },
        {
          type: 'PERSON',
          label: 'Person 3',
        },
      ]);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should handle batch add errors gracefully', async () => {
      const node = await graph.addNode({
        type: 'LOCATION',
        label: 'Location 1',
      });

      const result = await graph.batchAddEdges([
        {
          type: CommonEdgeType.LOCATED_IN,
          fromNodeId: node.id,
          toNodeId: 'non-existent-id',
        },
        {
          type: CommonEdgeType.LOCATED_IN,
          fromNodeId: node.id,
          toNodeId: node.id, // Self-edge
        },
      ]);

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should get graph statistics', async () => {
      await graph.addNode({
        type: 'PERSON',
        label: 'Person 1',
      });

      await graph.addNode({
        type: 'ORGANIZATION',
        label: 'Org 1',
      });

      const stats = await graph.getStats();
      expect(stats.nodeCount).toBe(2);
      expect(stats.nodesByType['PERSON']).toBe(1);
      expect(stats.nodesByType['ORGANIZATION']).toBe(1);
      expect(stats.edgeCount).toBe(0);
      expect(stats.averageDegree).toBe(0);
      expect(stats.density).toBe(0);
    });
  });
});
