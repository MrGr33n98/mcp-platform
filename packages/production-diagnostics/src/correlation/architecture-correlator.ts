import type { ArchitectureGraphData, ArchitectureNode } from "@mcp-platform/architecture-graph";

export interface RuntimeArchitectureContext {
  matchedNodes: ArchitectureNode[];
  connectedNodes: ArchitectureNode[];
  candidateTests: string[];
}

export class ArchitectureCorrelator {
  public static correlate(
    componentNames: string[],
    graph?: ArchitectureGraphData | undefined
  ): RuntimeArchitectureContext {
    if (!graph || componentNames.length === 0) {
      return {
        matchedNodes: [],
        connectedNodes: [],
        candidateTests: [],
      };
    }

    const matchedNodes: ArchitectureNode[] = [];
    const connectedNodeIds = new Set<string>();
    const candidateTests = new Set<string>();

    for (const comp of componentNames) {
      const cleanComp = comp.replace(/#.*$/, "").trim(); // Remove action suffix like Controller#show

      for (const node of graph.nodes) {
        if (
          node.name.toLowerCase() === cleanComp.toLowerCase() ||
          node.file.toLowerCase().includes(cleanComp.toLowerCase().replace(/::/g, "/")) ||
          cleanComp.toLowerCase().includes(node.name.toLowerCase())
        ) {
          if (!matchedNodes.some(m => m.id === node.id)) {
            matchedNodes.push(node);
          }
        }
      }
    }

    // Trace edges for connected nodes and tests
    for (const matched of matchedNodes) {
      for (const edge of graph.edges) {
        if (edge.source === matched.id) {
          connectedNodeIds.add(edge.target);
        } else if (edge.target === matched.id) {
          connectedNodeIds.add(edge.source);
        }

        // Check test relationships
        if (edge.type === "TESTS" || edge.type === "COVERS") {
          if (edge.target === matched.id || edge.source === matched.id) {
            const testNodeId = edge.target === matched.id ? edge.source : edge.target;
            const testNode = graph.nodes.find(n => n.id === testNodeId);
            if (testNode && testNode.type === "TEST_SPEC") {
              candidateTests.add(testNode.file);
            }
          }
        }
      }
    }

    const connectedNodes = graph.nodes.filter(
      n => connectedNodeIds.has(n.id) && !matchedNodes.some(m => m.id === n.id)
    );

    // If candidateTests is empty, search for spec files matching matched node files
    if (candidateTests.size === 0) {
      for (const matched of matchedNodes) {
        const specName = matched.file
          .replace(/^app\//, "spec/")
          .replace(/\.rb$/, "_spec.rb");
        const found = graph.nodes.find(n => n.file === specName);
        if (found) {
          candidateTests.add(found.file);
        }
      }
    }

    return {
      matchedNodes,
      connectedNodes,
      candidateTests: Array.from(candidateTests),
    };
  }
}
