# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build & Development

- `npm run build` - Build the library using tsup
- `npm run dev` - Build with watch mode for development
- `npm run typecheck` - Run TypeScript type checking without emitting files

### Testing

- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- Run a single test file: `npx vitest run tests/basic.test.ts`

### Code Quality

- `npm run lint` - Run ESLint on TypeScript files
- `npm run format` - Format code with Prettier

### Examples

- `npm run example:basic` - Run basic usage example
- `npm run example:custom-extraction` - Run custom extraction example
- `npm run example:custom-types` - Run custom types example
- `npm run example:visualization` - Run visualization example
- `npm run example:viz-server` - Run visualization server with Bun

## Architecture

@fluxgraph/knowledge is a flexible, database-agnostic knowledge graph implementation for TypeScript that supports multiple database backends.

### Core Components

1. **KnowledgeGraph** (`src/core/KnowledgeGraph.ts`)
   - Main entry point for all graph operations
   - Provides high-level API for nodes, edges, queries, and search
   - Database-agnostic, works through adapters

2. **Database Adapters** (`src/adapters/`)
   - `BaseAdapter`: Abstract class defining the adapter interface
   - `SQLiteAdapter`: Node.js SQLite implementation using better-sqlite3
   - `D1Adapter`: Cloudflare D1 implementation
   - `BunSQLiteAdapter`: Bun-specific SQLite implementation
   - Adapters handle low-level database operations and queries

3. **Knowledge Extraction** (`src/extraction/`)
   - `KnowledgeExtractor`: Extracts entities and relationships from text
   - Supports custom patterns for entity and relationship extraction
   - Can process conversations and structured text

4. **Graph Algorithms** (`src/algorithms/`)
   - Path finding (shortest path, all paths)
   - Centrality measures (degree, PageRank)
   - Community detection
   - Cycle detection and clustering

5. **Visualization** (`src/visualization/`)
   - Mermaid diagram generation for knowledge graphs
   - `MermaidGraphVisualizer`: Generates Mermaid diagram syntax
   - `MermaidUtils`: Utilities for HTML/Markdown output

### Type System

- Uses TypeScript generics for custom node types
- Core types in `src/types/index.ts`
- Database schema defined in `src/schema/index.ts` using Drizzle ORM

### Database Schema

Tables created in all adapters:

- `kg_nodes`: Node storage with type, label, properties (JSON), confidence
- `kg_edges`: Edge storage with type, from/to nodes, properties (JSON)
- `kg_node_indices`: Indexes for efficient node lookups
- `kg_edge_indices`: Indexes for efficient edge lookups
- `kg_search_index`: Full-text search index
- `kg_graph_metadata`: Graph-level metadata

### Key Design Patterns

1. **Adapter Pattern**: Database operations abstracted behind adapters
2. **Factory Pattern**: `createKnowledgeGraph()` and `createAdapter()` for easy instantiation
3. **Builder Pattern**: Mermaid diagram options built incrementally
4. **Strategy Pattern**: Different output formats (HTML, Markdown, Live Editor) for Mermaid diagrams

when writing commits and pull requests don't put Claude Code as the author
