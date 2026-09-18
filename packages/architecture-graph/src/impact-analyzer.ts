import type { ArchitectureGraphData, ArchitectureNode, ArchitectureEdge } from "./types.js";

export class ImpactAnalyzer {
  private graph: ArchitectureGraphData;
  private nodeMap: Map<string, ArchitectureNode>;
  private edgeMap: Map<string, ArchitectureEdge>;
  private outboundEdges: Map<string, ArchitectureEdge[]>;
  private inboundEdges: Map<string, ArchitectureEdge[]>;

  constructor(graph: ArchitectureGraphData) {
    this.graph = graph;
    this.nodeMap = new Map();
    this.edgeMap = new Map();
    this.outboundEdges = new Map();
    this.inboundEdges = new Map();

    for (const node of graph.nodes) {
      this.nodeMap.set(node.id, node);
      this.outboundEdges.set(node.id, []);
      this.inboundEdges.set(node.id, []);
    }

    for (const edge of graph.edges) {
      if (edge.edgeId) {
        this.edgeMap.set(edge.edgeId, edge);
      }
      if (!this.outboundEdges.has(edge.source)) this.outboundEdges.set(edge.source, []);
      if (!this.inboundEdges.has(edge.target)) this.inboundEdges.set(edge.target, []);

      this.outboundEdges.get(edge.source)!.push(edge);
      this.inboundEdges.get(edge.target)!.push(edge);
    }
  }

  public getNode(id: string): ArchitectureNode | undefined {
    return this.nodeMap.get(id);
  }

  public whyEdge(edgeId: string): ArchitectureEdge["evidence"] | undefined {
    return this.edgeMap.get(edgeId)?.evidence;
  }

  public whatUsesModel(modelName: string): ArchitectureNode[] {
    const modelId = `model:${modelName}`;
    const inEdges = this.inboundEdges.get(modelId) || [];
    return inEdges
      .map((e) => this.nodeMap.get(e.source))
      .filter((n): n is ArchitectureNode => !!n);
  }

  public whatProtectsController(controllerName: string): ArchitectureNode[] {
    const controllerId = `controller:${controllerName}`;
    const outEdges = this.outboundEdges.get(controllerId) || [];
    return outEdges
      .filter((e) => e.type === "AUTHORIZES_WITH")
      .map((e) => this.nodeMap.get(e.target))
      .filter((n): n is ArchitectureNode => !!n);
  }

  public whatTestsProtectComponent(componentId: string): ArchitectureNode[] {
    // Check both inbound TESTS edges and outbound COVERS edges
    const inEdges = this.inboundEdges.get(componentId) || [];
    const testNodesFromIn = inEdges
      .filter((e) => e.type === "TESTS")
      .map((e) => this.nodeMap.get(e.source))
      .filter((n): n is ArchitectureNode => !!n);

    const outEdges = this.outboundEdges.get(componentId) || [];
    const testNodesFromOut = outEdges
      .filter((e) => e.type === "COVERS")
      .map((e) => this.nodeMap.get(e.target))
      .filter((n): n is ArchitectureNode => !!n);

    const allTestNodes = [...testNodesFromIn, ...testNodesFromOut];
    const unique = new Map<string, ArchitectureNode>();
    for (const node of allTestNodes) {
      unique.set(node.id, node);
    }
    return Array.from(unique.values());
  }

  public whatTablesAreAffected(modelName: string): ArchitectureNode[] {
    const modelId = `model:${modelName}`;
    const outEdges = this.outboundEdges.get(modelId) || [];
    return outEdges
      .filter((e) => e.type === "PERSISTS_TO")
      .map((e) => this.nodeMap.get(e.target))
      .filter((n): n is ArchitectureNode => !!n);
  }

  public getDownstreamDependencies(nodeId: string, visited = new Set<string>()): ArchitectureNode[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const outEdges = this.outboundEdges.get(nodeId) || [];
    const directTargets = outEdges
      .map((e) => this.nodeMap.get(e.target))
      .filter((n): n is ArchitectureNode => !!n);

    const deepTargets: ArchitectureNode[] = [...directTargets];
    for (const target of directTargets) {
      deepTargets.push(...this.getDownstreamDependencies(target.id, visited));
    }

    return deepTargets;
  }

  public getUpstreamDependents(nodeId: string, visited = new Set<string>()): ArchitectureNode[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    const inEdges = this.inboundEdges.get(nodeId) || [];
    const directSources = inEdges
      .map((e) => this.nodeMap.get(e.source))
      .filter((n): n is ArchitectureNode => !!n);

    const deepSources: ArchitectureNode[] = [...directSources];
    for (const src of directSources) {
      deepSources.push(...this.getUpstreamDependents(src.id, visited));
    }

    return deepSources;
  }
}
