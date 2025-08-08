import { KnowledgeGraph } from '../core/KnowledgeGraph';
import { NodeType, CommonEdgeType, ExtractedKnowledge, ExtractedNodeData, ExtractedEdgeData } from '../types';

/**
 * Options for knowledge extraction
 */
export interface ExtractionOptions {
  minConfidence?: number;
  extractEntities?: boolean;
  extractRelationships?: boolean;
  extractTopics?: boolean;
  extractSentiment?: boolean;
  mergeStrategy?: 'replace' | 'merge' | 'skip';
  sessionId?: string;
}

/**
 * Entity pattern for extraction
 */
export interface EntityPattern {
  pattern: RegExp;
  type: string;
  extractor?: (match: RegExpMatchArray) => Partial<ExtractedNodeData>;
}

/**
 * Relationship pattern for extraction
 */
export interface RelationshipPattern {
  pattern: RegExp;
  type: string;
  extractor?: (match: RegExpMatchArray, nodes: Map<string, ExtractedNodeData>) => Partial<ExtractedEdgeData>;
}

/**
 * Knowledge extraction service
 */
export class KnowledgeExtractor {
  private graph: KnowledgeGraph;
  private entityPatterns: EntityPattern[] = [];
  private relationshipPatterns: RelationshipPattern[] = [];

  constructor(graph: KnowledgeGraph) {
    this.graph = graph;
    this.setupDefaultPatterns();
  }

  /**
   * Setup default extraction patterns
   */
  private setupDefaultPatterns(): void {
    // Email patterns
    this.entityPatterns.push({
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      type: 'PERSON',
      extractor: (match) => ({
        label: match[0],
        properties: { type: 'email', value: match[0] },
      }),
    });

    // URL patterns
    this.entityPatterns.push({
      pattern: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g,
      type: 'DOCUMENT',
      extractor: (match) => ({
        label: new URL(match[0]).hostname,
        properties: { url: match[0], type: 'website' },
      }),
    });

    // Phone number patterns
    this.entityPatterns.push({
      pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
      type: 'PERSON',
      extractor: (match) => ({
        label: match[0],
        properties: { type: 'phone', value: match[0] },
      }),
    });

    // Date patterns
    this.entityPatterns.push({
      pattern: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g,
      type: 'EVENT',
      extractor: (match) => ({
        label: match[0],
        properties: { type: 'date', value: match[0] },
      }),
    });

    // Money patterns
    this.entityPatterns.push({
      pattern: /[$£€¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?/g,
      type: 'FINANCIAL',
      extractor: (match) => ({
        label: match[0],
        properties: {
          type: 'amount',
          value: parseFloat(match[0].replace(/[$£€¥,]/g, '')),
          currency: match[0][0],
        },
      }),
    });
  }

  /**
   * Add custom entity pattern
   */
  addEntityPattern(pattern: EntityPattern): void {
    this.entityPatterns.push(pattern);
  }

  /**
   * Add custom relationship pattern
   */
  addRelationshipPattern(pattern: RelationshipPattern): void {
    this.relationshipPatterns.push(pattern);
  }

  /**
   * Extract knowledge from text
   */
  async extractFromText(text: string, options: ExtractionOptions = {}): Promise<ExtractedKnowledge> {
    const nodes: ExtractedNodeData[] = [];
    const edges: ExtractedEdgeData[] = [];
    const extractedEntities = new Map<string, ExtractedNodeData>();

    // Extract entities
    if (options.extractEntities !== false) {
      for (const pattern of this.entityPatterns) {
        const matches = Array.from(text.matchAll(pattern.pattern));

        for (const match of matches) {
          const baseData = pattern.extractor ? pattern.extractor(match) : { label: match[0], properties: {} };

          const nodeData: ExtractedNodeData = {
            type: pattern.type,
            label: baseData.label || match[0],
            properties: baseData.properties || {},
            confidence: baseData.confidence || 0.7,
            sourceSessionIds: options.sessionId ? [options.sessionId] : undefined,
          };

          if (!options.minConfidence || nodeData.confidence >= options.minConfidence) {
            nodes.push(nodeData);
            extractedEntities.set(nodeData.label, nodeData);
          }
        }
      }
    }

    // Extract relationships
    if (options.extractRelationships !== false && extractedEntities.size > 1) {
      // Simple co-occurrence based relationships
      const entities = Array.from(extractedEntities.values());
      const sentences = text.split(/[.!?]+/);

      for (const sentence of sentences) {
        const sentenceEntities = entities.filter((e) => sentence.toLowerCase().includes(e.label.toLowerCase()));

        // Create relationships between entities mentioned in the same sentence
        for (let i = 0; i < sentenceEntities.length; i++) {
          for (let j = i + 1; j < sentenceEntities.length; j++) {
            const fromEntity = sentenceEntities[i];
            const toEntity = sentenceEntities[j];
            if (!fromEntity || !toEntity) continue;

            const edgeData: ExtractedEdgeData = {
              type: CommonEdgeType.RELATED_TO,
              fromNodeLabel: fromEntity.label,
              toNodeLabel: toEntity.label,
              properties: { context: 'co-occurrence', sentence: sentence.trim() },
              confidence: 0.5,
              sourceSessionIds: options.sessionId ? [options.sessionId] : undefined,
            };

            if (!options.minConfidence || edgeData.confidence >= options.minConfidence) {
              edges.push(edgeData);
            }
          }
        }
      }

      // Apply custom relationship patterns
      for (const pattern of this.relationshipPatterns) {
        const matches = Array.from(text.matchAll(pattern.pattern));

        for (const match of matches) {
          const baseData = pattern.extractor ? pattern.extractor(match, extractedEntities) : null;

          if (baseData) {
            const edgeData: ExtractedEdgeData = {
              type: pattern.type,
              fromNodeLabel: baseData.fromNodeLabel || '',
              toNodeLabel: baseData.toNodeLabel || '',
              properties: baseData.properties || {},
              confidence: baseData.confidence || 0.6,
              sourceSessionIds: options.sessionId ? [options.sessionId] : undefined,
            };

            if (!options.minConfidence || edgeData.confidence >= options.minConfidence) {
              edges.push(edgeData);
            }
          }
        }
      }
    }

    // Extract topics
    const topics: string[] = [];
    if (options.extractTopics !== false) {
      const topicKeywords = [
        'technology',
        'finance',
        'health',
        'education',
        'business',
        'science',
        'politics',
        'sports',
        'entertainment',
        'travel',
        'food',
        'art',
        'music',
        'environment',
        'social',
      ];

      const lowerText = text.toLowerCase();
      for (const keyword of topicKeywords) {
        if (lowerText.includes(keyword)) {
          topics.push(keyword);

          // Add topic as a node
          nodes.push({
            type: 'TOPIC',
            label: keyword,
            properties: { extracted: true },
            confidence: 0.8,
            sourceSessionIds: options.sessionId ? [options.sessionId] : undefined,
          });
        }
      }
    }

    return {
      nodes,
      edges,
      confidence: this.calculateOverallConfidence(nodes, edges),
      metadata: {
        topics,
        extractedAt: new Date().toISOString(),
        textLength: text.length,
        entityCount: nodes.length,
        relationshipCount: edges.length,
      },
    };
  }

  /**
   * Extract knowledge from structured data
   */
  async extractFromStructured(data: Record<string, any>, options: ExtractionOptions = {}): Promise<ExtractedKnowledge> {
    const nodes: ExtractedNodeData[] = [];
    const edges: ExtractedEdgeData[] = [];

    // Recursive extraction from nested objects
    const extractFromObject = (obj: Record<string, any>, parentLabel?: string, parentType?: NodeType | string) => {
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;

        if (typeof value === 'object' && !Array.isArray(value)) {
          // Create node for nested object
          const nodeData: ExtractedNodeData = {
            type: this.inferNodeType(key, value),
            label: value.name || value.title || value.label || key,
            properties: { ...value, key },
            confidence: 0.9,
            sourceSessionIds: options.sessionId ? [options.sessionId] : undefined,
          };

          nodes.push(nodeData);

          // Create relationship to parent if exists
          if (parentLabel) {
            edges.push({
              type: CommonEdgeType.PART_OF,
              fromNodeLabel: nodeData.label,
              toNodeLabel: parentLabel,
              properties: { key },
              confidence: 0.9,
              sourceSessionIds: options.sessionId ? [options.sessionId] : undefined,
            });
          }

          // Recurse into nested object
          extractFromObject(value, nodeData.label, nodeData.type);
        } else if (Array.isArray(value)) {
          // Process arrays
          for (const item of value) {
            if (typeof item === 'object') {
              extractFromObject(item, parentLabel, parentType);
            }
          }
        }
      }
    };

    extractFromObject(data);

    return {
      nodes,
      edges,
      confidence: 0.9,
      metadata: {
        extractedAt: new Date().toISOString(),
        dataKeys: Object.keys(data),
      },
    };
  }

  /**
   * Process extracted knowledge and add to graph
   */
  async processExtractedKnowledge(extraction: ExtractedKnowledge, options: ExtractionOptions = {}): Promise<{ nodesAdded: number; edgesAdded: number }> {
    const nodeMap = new Map<string, string>(); // label -> id mapping
    let nodesAdded = 0;
    let edgesAdded = 0;

    // Process nodes
    for (const nodeData of extraction.nodes) {
      // Check if node already exists
      const existingNodes = await this.graph.findNodesByLabel(nodeData.label, true);

      let nodeId: string;

      if (existingNodes.length > 0) {
        // Node exists - update or skip based on merge strategy
        const existingNode = existingNodes[0];
        if (!existingNode) continue;

        nodeId = existingNode.id;

        if (options.mergeStrategy === 'merge') {
          await this.graph.updateNode(
            nodeId,
            {
              properties: { ...existingNode.properties, ...nodeData.properties },
              confidence: (existingNode.confidence + nodeData.confidence) / 2,
              sourceSessionId: options.sessionId,
            },
            true
          );
        } else if (options.mergeStrategy === 'replace') {
          await this.graph.updateNode(
            nodeId,
            {
              type: nodeData.type,
              properties: nodeData.properties,
              confidence: nodeData.confidence,
              sourceSessionId: options.sessionId,
            },
            false
          );
        }
        // 'skip' - do nothing
      } else {
        // Create new node
        const newNode = await this.graph.addNode({
          type: nodeData.type,
          label: nodeData.label,
          properties: nodeData.properties,
          confidence: nodeData.confidence,
          sourceSessionId: options.sessionId,
        });

        nodeId = newNode.id;
        nodesAdded++;
      }

      nodeMap.set(nodeData.label, nodeId);
    }

    // Process edges
    for (const edgeData of extraction.edges) {
      const fromNodeId = nodeMap.get(edgeData.fromNodeLabel);
      const toNodeId = nodeMap.get(edgeData.toNodeLabel);

      if (fromNodeId && toNodeId) {
        // Check if edge already exists
        const existingEdges = await this.graph.getEdgesBetween(fromNodeId, toNodeId, edgeData.type);

        if (existingEdges.length === 0) {
          await this.graph.addEdge({
            type: edgeData.type,
            fromNodeId,
            toNodeId,
            properties: edgeData.properties,
            confidence: edgeData.confidence,
            sourceSessionId: options.sessionId,
          });

          edgesAdded++;
        }
      }
    }

    return { nodesAdded, edgesAdded };
  }

  /**
   * Extract knowledge from conversation/chat messages
   */
  async extractFromConversation(messages: Array<{ role: string; content: string }>, options: ExtractionOptions = {}): Promise<ExtractedKnowledge> {
    const allNodes: ExtractedNodeData[] = [];
    const allEdges: ExtractedEdgeData[] = [];
    const conversationContext: Record<string, any> = {};

    // Track entities across messages
    const entityMentions = new Map<string, number>();

    for (const message of messages) {
      const extraction = await this.extractFromText(message.content, options);

      // Boost confidence for repeatedly mentioned entities
      for (const node of extraction.nodes) {
        const mentions = (entityMentions.get(node.label) || 0) + 1;
        entityMentions.set(node.label, mentions);

        node.confidence = Math.min(1.0, node.confidence + (mentions - 1) * 0.1);
        node.properties = {
          ...node.properties,
          role: message.role,
          mentions,
        };

        allNodes.push(node);
      }

      allEdges.push(...extraction.edges);

      // Extract conversation metadata
      if (message.role === 'user') {
        conversationContext.userTopics = extraction.metadata?.topics || [];
      }
    }

    // Deduplicate nodes with same label
    const uniqueNodes = new Map<string, ExtractedNodeData>();
    for (const node of allNodes) {
      const existing = uniqueNodes.get(node.label);
      if (existing) {
        // Merge properties and boost confidence
        existing.properties = { ...existing.properties, ...node.properties };
        existing.confidence = Math.min(1.0, (existing.confidence + node.confidence) / 2);
      } else {
        uniqueNodes.set(node.label, node);
      }
    }

    return {
      nodes: Array.from(uniqueNodes.values()),
      edges: allEdges,
      confidence: this.calculateOverallConfidence(Array.from(uniqueNodes.values()), allEdges),
      metadata: {
        messageCount: messages.length,
        entityMentions: Object.fromEntries(entityMentions),
        conversationContext,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Infer node type from key and value
   */
  private inferNodeType(key: string, value: any): string {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('person') || lowerKey.includes('user') || lowerKey.includes('customer')) {
      return 'PERSON';
    }
    if (lowerKey.includes('company') || lowerKey.includes('organization') || lowerKey.includes('org')) {
      return 'ORGANIZATION';
    }
    if (lowerKey.includes('location') || lowerKey.includes('address') || lowerKey.includes('place')) {
      return 'LOCATION';
    }
    if (lowerKey.includes('event') || lowerKey.includes('meeting') || lowerKey.includes('appointment')) {
      return 'EVENT';
    }
    if (lowerKey.includes('product') || lowerKey.includes('item')) {
      return 'PRODUCT';
    }
    if (lowerKey.includes('service')) {
      return 'SERVICE';
    }
    if (lowerKey.includes('document') || lowerKey.includes('file') || lowerKey.includes('report')) {
      return 'DOCUMENT';
    }
    if (lowerKey.includes('skill') || lowerKey.includes('ability')) {
      return 'SKILL';
    }
    if (lowerKey.includes('goal') || lowerKey.includes('objective')) {
      return 'GOAL';
    }

    // Check value type
    if (typeof value === 'object') {
      if (value.email || value.phone) return 'PERSON';
      if (value.amount || value.price || value.cost) return 'FINANCIAL';
      if (value.latitude || value.longitude || value.address) return 'LOCATION';
    }

    return 'CUSTOM';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(nodes: ExtractedNodeData[], edges: ExtractedEdgeData[]): number {
    if (nodes.length === 0 && edges.length === 0) return 0;

    const nodeConfidence = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length : 0;

    const edgeConfidence = edges.length > 0 ? edges.reduce((sum, e) => sum + e.confidence, 0) / edges.length : 0;

    const weight = nodes.length + edges.length;
    return (nodeConfidence * nodes.length + edgeConfidence * edges.length) / weight;
  }
}

// Export convenience functions
export async function extractFromText(graph: KnowledgeGraph, text: string, options?: ExtractionOptions): Promise<ExtractedKnowledge> {
  const extractor = new KnowledgeExtractor(graph);
  return extractor.extractFromText(text, options);
}

export async function extractFromConversation(graph: KnowledgeGraph, messages: Array<{ role: string; content: string }>, options?: ExtractionOptions): Promise<ExtractedKnowledge> {
  const extractor = new KnowledgeExtractor(graph);
  return extractor.extractFromConversation(messages, options);
}

export async function processExtractedKnowledge(
  graph: KnowledgeGraph,
  extraction: ExtractedKnowledge,
  options?: ExtractionOptions
): Promise<{ nodesAdded: number; edgesAdded: number }> {
  const extractor = new KnowledgeExtractor(graph);
  return extractor.processExtractedKnowledge(extraction, options);
}
