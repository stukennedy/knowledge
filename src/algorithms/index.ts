import { KnowledgeGraph } from '../core/KnowledgeGraph';
import { KnowledgeNode, KnowledgeEdge } from '../types';

/**
 * Graph algorithms for analyzing and working with knowledge graphs
 */
export class GraphAlgorithms {
  private graph: KnowledgeGraph;
  
  constructor(graph: KnowledgeGraph) {
    this.graph = graph;
  }
  
  /**
   * Calculate degree centrality for a node
   * Degree centrality is the number of edges connected to a node
   */
  async degreeCentrality(nodeId: string): Promise<number> {
    const result = await this.graph.queryRelated(nodeId, { depth: 1 });
    return result.edges.length;
  }
  
  /**
   * Calculate degree centrality for all nodes
   */
  async allDegreeCentrality(): Promise<Map<string, number>> {
    const centrality = new Map<string, number>();
    
    // This is a simplified implementation
    // In production, you'd want to batch this operation
    const nodes = await this.graph.queryByType('CUSTOM', { limit: 1000 });
    
    for (const node of nodes.nodes) {
      const degree = await this.degreeCentrality(node.id);
      centrality.set(node.id, degree);
    }
    
    return centrality;
  }
  
  /**
   * Find all paths between two nodes up to a maximum length
   */
  async findAllPaths(
    fromNodeId: string,
    toNodeId: string,
    maxLength = 5
  ): Promise<Array<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[]; length: number }>> {
    const paths: Array<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[]; length: number }> = [];
    
    // Use DFS to find all paths
    const visited = new Set<string>();
    const currentPath: string[] = [];
    const currentEdges: KnowledgeEdge[] = [];
    
    const dfs = async (currentNodeId: string, depth: number) => {
      if (depth > maxLength) return;
      
      if (currentNodeId === toNodeId) {
        // Found a path
        const nodeObjects = await Promise.all(
          [...currentPath, currentNodeId].map(id => this.graph.getNode(id))
        );
        
        paths.push({
          nodes: nodeObjects.filter(n => n !== null) as KnowledgeNode[],
          edges: [...currentEdges],
          length: currentPath.length,
        });
        return;
      }
      
      if (visited.has(currentNodeId)) return;
      
      visited.add(currentNodeId);
      currentPath.push(currentNodeId);
      
      // Get all outgoing edges
      const result = await this.graph.queryRelated(currentNodeId, { 
        depth: 1, 
        direction: 'out' 
      });
      
      for (const edge of result.edges) {
        if (edge.fromNodeId === currentNodeId) {
          currentEdges.push(edge);
          await dfs(edge.toNodeId, depth + 1);
          currentEdges.pop();
        }
      }
      
      currentPath.pop();
      visited.delete(currentNodeId);
    };
    
    await dfs(fromNodeId, 0);
    return paths;
  }
  
  /**
   * Detect cycles in the graph
   */
  async detectCycles(): Promise<Array<{ nodes: string[]; edges: KnowledgeEdge[] }>> {
    const cycles: Array<{ nodes: string[]; edges: KnowledgeEdge[] }> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];
    const pathEdges: KnowledgeEdge[] = [];
    
    const dfs = async (nodeId: string): Promise<boolean> => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const result = await this.graph.queryRelated(nodeId, { 
        depth: 1, 
        direction: 'out' 
      });
      
      for (const edge of result.edges) {
        if (edge.fromNodeId === nodeId) {
          pathEdges.push(edge);
          
          if (!visited.has(edge.toNodeId)) {
            if (await dfs(edge.toNodeId)) {
              return true;
            }
          } else if (recursionStack.has(edge.toNodeId)) {
            // Found a cycle
            const cycleStartIndex = path.indexOf(edge.toNodeId);
            cycles.push({
              nodes: path.slice(cycleStartIndex),
              edges: pathEdges.slice(cycleStartIndex),
            });
          }
          
          pathEdges.pop();
        }
      }
      
      path.pop();
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Check all nodes for cycles
    const nodes = await this.graph.queryByType('CUSTOM', { limit: 1000 });
    
    for (const node of nodes.nodes) {
      if (!visited.has(node.id)) {
        await dfs(node.id);
      }
    }
    
    return cycles;
  }
  
  /**
   * Find connected components in the graph
   */
  async findConnectedComponents(): Promise<Array<Set<string>>> {
    const components: Array<Set<string>> = [];
    const visited = new Set<string>();
    
    const dfs = async (nodeId: string, component: Set<string>) => {
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      component.add(nodeId);
      
      const result = await this.graph.queryRelated(nodeId, { 
        depth: 1, 
        direction: 'both' 
      });
      
      for (const node of result.nodes) {
        if (node.id !== nodeId && !visited.has(node.id)) {
          await dfs(node.id, component);
        }
      }
    };
    
    // Get all nodes
    const nodes = await this.graph.queryByType('CUSTOM', { limit: 10000 });
    
    for (const node of nodes.nodes) {
      if (!visited.has(node.id)) {
        const component = new Set<string>();
        await dfs(node.id, component);
        components.push(component);
      }
    }
    
    return components;
  }
  
  /**
   * Calculate PageRank for all nodes
   * Simplified implementation - real PageRank would need iterative computation
   */
  async pageRank(
    damping = 0.85,
    iterations = 10
  ): Promise<Map<string, number>> {
    const pageRank = new Map<string, number>();
    const nodes = await this.graph.queryByType('CUSTOM', { limit: 10000 });
    const nodeIds = nodes.nodes.map(n => n.id);
    const N = nodeIds.length;
    
    // Initialize PageRank values
    for (const nodeId of nodeIds) {
      pageRank.set(nodeId, 1 / N);
    }
    
    // Iterative computation
    for (let iter = 0; iter < iterations; iter++) {
      const newPageRank = new Map<string, number>();
      
      for (const nodeId of nodeIds) {
        let rank = (1 - damping) / N;
        
        // Get incoming edges
        const result = await this.graph.queryRelated(nodeId, { 
          depth: 1, 
          direction: 'in' 
        });
        
        for (const edge of result.edges) {
          if (edge.toNodeId === nodeId) {
            const sourceRank = pageRank.get(edge.fromNodeId) || 0;
            const sourceOutDegree = await this.degreeCentrality(edge.fromNodeId);
            rank += damping * (sourceRank / Math.max(sourceOutDegree, 1));
          }
        }
        
        newPageRank.set(nodeId, rank);
      }
      
      // Update PageRank values
      for (const [nodeId, rank] of newPageRank) {
        pageRank.set(nodeId, rank || 0);
      }
    }
    
    return pageRank;
  }
  
  /**
   * Find nodes that form a clique (fully connected subgraph)
   */
  async findCliques(minSize = 3): Promise<Array<Set<string>>> {
    const cliques: Array<Set<string>> = [];
    const nodes = await this.graph.queryByType('CUSTOM', { limit: 1000 });
    const nodeIds = nodes.nodes.map(n => n.id);
    
    // Bron-Kerbosch algorithm (simplified)
    const bronKerbosch = async (
      R: Set<string>,
      P: Set<string>,
      X: Set<string>
    ) => {
      if (P.size === 0 && X.size === 0) {
        if (R.size >= minSize) {
          cliques.push(new Set(R));
        }
        return;
      }
      
      for (const v of P) {
        const neighbors = new Set<string>();
        const result = await this.graph.queryRelated(v, { depth: 1 });
        
        for (const node of result.nodes) {
          if (node.id !== v) {
            neighbors.add(node.id);
          }
        }
        
        const newR = new Set(R);
        newR.add(v);
        
        const newP = new Set<string>();
        for (const p of P) {
          if (neighbors.has(p)) newP.add(p);
        }
        
        const newX = new Set<string>();
        for (const x of X) {
          if (neighbors.has(x)) newX.add(x);
        }
        
        await bronKerbosch(newR, newP, newX);
        
        P.delete(v);
        X.add(v);
      }
    };
    
    await bronKerbosch(new Set(), new Set(nodeIds), new Set());
    return cliques;
  }
  
  /**
   * Calculate clustering coefficient for a node
   */
  async clusteringCoefficient(nodeId: string): Promise<number> {
    const result = await this.graph.queryRelated(nodeId, { depth: 1 });
    const neighbors = result.nodes.filter(n => n.id !== nodeId);
    
    if (neighbors.length < 2) return 0;
    
    let triangles = 0;
    const possibleTriangles = (neighbors.length * (neighbors.length - 1)) / 2;
    
    // Check how many neighbors are connected to each other
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const neighborI = neighbors[i];
        const neighborJ = neighbors[j];
        if (!neighborI || !neighborJ) continue;
        
        const edges = await this.graph.getEdgesBetween(
          neighborI.id,
          neighborJ.id
        );
        
        if (edges.length > 0) {
          triangles++;
        }
      }
    }
    
    return triangles / possibleTriangles;
  }
  
  /**
   * Find communities using label propagation
   */
  async detectCommunities(): Promise<Map<string, number>> {
    const communities = new Map<string, number>();
    const nodes = await this.graph.queryByType('CUSTOM', { limit: 1000 });
    
    // Initialize each node with its own community
    let communityId = 0;
    for (const node of nodes.nodes) {
      communities.set(node.id, communityId++);
    }
    
    // Iterate until convergence
    let changed = true;
    let iterations = 0;
    const maxIterations = 10;
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      for (const node of nodes.nodes) {
        const result = await this.graph.queryRelated(node.id, { depth: 1 });
        
        // Count community labels of neighbors
        const labelCounts = new Map<number, number>();
        
        for (const neighbor of result.nodes) {
          if (neighbor.id !== node.id) {
            const label = communities.get(neighbor.id);
            if (label !== undefined) {
              labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
            }
          }
        }
        
        // Adopt the most common label
        if (labelCounts.size > 0) {
          const maxLabel = Array.from(labelCounts.entries())
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];
          
          if (communities.get(node.id) !== maxLabel) {
            communities.set(node.id, maxLabel);
            changed = true;
          }
        }
      }
    }
    
    return communities;
  }
}

// Export convenience functions
export async function degreeCentrality(graph: KnowledgeGraph, nodeId: string): Promise<number> {
  const algorithms = new GraphAlgorithms(graph);
  return algorithms.degreeCentrality(nodeId);
}

export async function findShortestPath(
  graph: KnowledgeGraph,
  fromNodeId: string,
  toNodeId: string
): Promise<any> {
  return graph.findShortestPath(fromNodeId, toNodeId);
}

export async function detectCycles(graph: KnowledgeGraph): Promise<any> {
  const algorithms = new GraphAlgorithms(graph);
  return algorithms.detectCycles();
}

export async function pageRank(graph: KnowledgeGraph): Promise<Map<string, number>> {
  const algorithms = new GraphAlgorithms(graph);
  return algorithms.pageRank();
}