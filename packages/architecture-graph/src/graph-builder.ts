import type { RepositoryManifest, ControllerDefinition, ProductWorkspace } from "@mcp-platform/repository-intelligence";
import type {
  ArchitectureGraphData,
  ArchitectureNode,
  ArchitectureEdge
} from "./types.js";

export class ArchitectureGraphBuilder {
  public static buildFromWorkspace(workspace: ProductWorkspace): ArchitectureGraphData {
    const combinedNodes: ArchitectureNode[] = [];
    const combinedEdges: ArchitectureEdge[] = [];
    const nodeIds = new Set<string>();

    for (const [key, manifest] of Object.entries(workspace.manifests)) {
      const partialGraph = this.build(manifest);
      for (const node of partialGraph.nodes) {
        if (!nodeIds.has(node.id)) {
          combinedNodes.push({
            ...node,
            metadata: {
              ...node.metadata,
              appScope: key
            }
          });
          nodeIds.add(node.id);
        }
      }
      for (const edge of partialGraph.edges) {
        combinedEdges.push(edge);
      }
    }

    return {
      graphVersion: 1,
      generatedAt: new Date().toISOString(),
      nodes: combinedNodes,
      edges: combinedEdges
    };
  }

  public static build(manifest: RepositoryManifest): ArchitectureGraphData {
    const nodes: ArchitectureNode[] = [];
    const edges: ArchitectureEdge[] = [];
    const nodeIds = new Set<string>();

    function addNode(node: ArchitectureNode) {
      if (!nodeIds.has(node.id)) {
        nodes.push(node);
        nodeIds.add(node.id);
      }
    }

    function addEdge(edge: ArchitectureEdge) {
      edges.push(edge);
    }

    // 1. Tables
    for (const table of manifest.database.tables) {
      addNode({
        id: `table:${table.name}`,
        type: "TABLE",
        name: table.name,
        file: "db/schema.rb",
        metadata: {
          columnCount: table.columns.length,
          indexes: table.indexes
        }
      });
    }

    // 2. Models
    for (const model of manifest.backend.models) {
      const modelNodeId = `model:${model.name}`;
      addNode({
        id: modelNodeId,
        type: "MODEL",
        name: model.name,
        file: model.file,
        metadata: {
          tableName: model.tableName,
          isTenantScoped: model.isTenantScoped,
          tenantKey: model.tenantKey
        }
      });

      // Edge Model -> Table (PERSISTS_TO)
      const tableNodeId = `table:${model.tableName}`;
      if (nodeIds.has(tableNodeId)) {
        addEdge({
          edgeId: `${modelNodeId}->PERSISTS_TO->${tableNodeId}`,
          source: modelNodeId,
          target: tableNodeId,
          type: "PERSISTS_TO",
          confidence: "HIGH",
          evidence: {
            file: model.file,
            symbol: model.name,
            rule: "ActiveRecord table mapping",
            reason: `ActiveRecord model ${model.name} maps to table ${model.tableName}`
          }
        });
      }

      // Edge Model -> Associations (DEPENDS_ON / USES)
      for (const assoc of model.associations) {
        const targetModelName = assoc.target.charAt(0).toUpperCase() + assoc.target.slice(1);
        const targetModelNodeId = `model:${targetModelName}`;
        addEdge({
          edgeId: `${modelNodeId}->${assoc.type === "belongs_to" ? "DEPENDS_ON" : "USES"}->${targetModelNodeId}`,
          source: modelNodeId,
          target: targetModelNodeId,
          type: assoc.type === "belongs_to" ? "DEPENDS_ON" : "USES",
          confidence: "HIGH",
          evidence: {
            file: model.file,
            symbol: model.name,
            rule: "ActiveRecord association macro",
            reason: `${model.name} ${assoc.type} :${assoc.target}`
          }
        });
      }
    }

    // 3. Policies
    for (const policy of manifest.backend.policies) {
      const policyNodeId = `policy:${policy.name}`;
      addNode({
        id: policyNodeId,
        type: "POLICY",
        name: policy.name,
        file: policy.file,
        metadata: {
          model: policy.model,
          actions: policy.actions
        }
      });

      const modelNodeId = `model:${policy.model}`;
      addEdge({
        edgeId: `${policyNodeId}->AUTHORIZES_WITH->${modelNodeId}`,
        source: policyNodeId,
        target: modelNodeId,
        type: "AUTHORIZES_WITH",
        confidence: "HIGH",
        evidence: {
          file: policy.file,
          symbol: policy.name,
          rule: "Pundit Policy convention",
          reason: `Pundit policy ${policy.name} guards domain model ${policy.model}`
        }
      });
    }

    // 4. Controllers
    for (const controller of manifest.backend.controllers) {
      const controllerNodeId = `controller:${controller.name}`;
      addNode({
        id: controllerNodeId,
        type: "CONTROLLER",
        name: controller.name,
        file: controller.file,
        metadata: {
          actions: controller.actions,
          tenantScoped: controller.tenantScoped
        }
      });

      if (controller.policyUsed) {
        const policyNodeId = `policy:${controller.policyUsed}Policy`;
        addEdge({
          edgeId: `${controllerNodeId}->AUTHORIZES_WITH->${policyNodeId}`,
          source: controllerNodeId,
          target: policyNodeId,
          type: "AUTHORIZES_WITH",
          confidence: "HIGH",
          evidence: {
            file: controller.file,
            symbol: controller.name,
            rule: "Pundit authorize call",
            reason: `Controller authorizes actions with ${controller.policyUsed}`
          }
        });
      }
    }

    // 5. Routes
    for (const route of manifest.backend.routes) {
      const routeNodeId = `route:${route.method}:${route.path}`;
      addNode({
        id: routeNodeId,
        type: "ROUTE",
        name: `${route.method} ${route.path}`,
        file: route.file,
        metadata: {
          controller: route.controller,
          action: route.action,
          line: route.line
        }
      });

      const controllerName = route.controller
        .split("/")
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("::") + "Controller";

      const matchedController = manifest.backend.controllers.find(
        (c: ControllerDefinition) => c.name === controllerName || c.name.endsWith(controllerName) || controllerName.endsWith(c.name)
      );

      if (matchedController) {
        addEdge({
          edgeId: `${routeNodeId}->ROUTES_TO->controller:${matchedController.name}`,
          source: routeNodeId,
          target: `controller:${matchedController.name}`,
          type: "ROUTES_TO",
          confidence: "HIGH",
          evidence: {
            file: route.file,
            line: route.line,
            rule: "Rails routing table declaration",
            reason: `HTTP route maps to ${matchedController.name}#${route.action}`
          }
        });
      }
    }

    // 6. Services
    for (const service of manifest.backend.services) {
      addNode({
        id: `service:${service.name}`,
        type: "SERVICE",
        name: service.name,
        file: service.file,
        metadata: {
          methods: service.methods
        }
      });
    }

    // 7. Jobs
    for (const job of manifest.backend.jobs) {
      const jobNodeId = `job:${job.name}`;
      addNode({
        id: jobNodeId,
        type: "JOB",
        name: job.name,
        file: job.file,
        metadata: {
          queue: job.queue
        }
      });

      const queueNodeId = `queue:${job.queue}`;
      addNode({
        id: queueNodeId,
        type: "QUEUE",
        name: job.queue,
        file: "config/sidekiq.yml"
      });

      addEdge({
        edgeId: `${jobNodeId}->ENQUEUES->${queueNodeId}`,
        source: jobNodeId,
        target: queueNodeId,
        type: "ENQUEUES",
        confidence: "HIGH",
        evidence: {
          file: job.file,
          symbol: job.name,
          rule: "ActiveJob queue_as macro",
          reason: `Job enqueues in Sidekiq queue '${job.queue}'`
        }
      });
    }

    // 8. ActiveAdmin Resources
    for (const adminRes of manifest.backend.adminResources) {
      const adminNodeId = `admin:${adminRes.name}`;
      addNode({
        id: adminNodeId,
        type: "ADMIN_RESOURCE",
        name: `Admin::${adminRes.name}`,
        file: adminRes.file,
        metadata: {
          model: adminRes.model
        }
      });

      const modelNodeId = `model:${adminRes.model}`;
      addEdge({
        edgeId: `${adminNodeId}->USES->${modelNodeId}`,
        source: adminNodeId,
        target: modelNodeId,
        type: "USES",
        confidence: "HIGH",
        evidence: {
          file: adminRes.file,
          symbol: adminRes.name,
          rule: "ActiveAdmin.register resource",
          reason: `ActiveAdmin registers backoffice resource for ${adminRes.model}`
        }
      });
    }

    // 9. Next.js Routes
    for (const nextRoute of manifest.frontend.routes) {
      addNode({
        id: `next_route:${nextRoute.path}`,
        type: "NEXT_ROUTE",
        name: nextRoute.path,
        file: nextRoute.file,
        metadata: {
          routeType: nextRoute.type
        }
      });
    }

    // 10. Test Specs & Coverage Mapping
    if (manifest.tests?.specs) {
      for (const spec of manifest.tests.specs) {
        const specNodeId = `spec:${spec.file}`;
        addNode({
          id: specNodeId,
          type: "TEST_SPEC",
          name: spec.file,
          file: spec.file,
          metadata: {
            specType: spec.type,
            targetComponent: spec.targetComponent
          }
        });

        if (spec.targetComponent) {
          // Find matching model, controller, policy or service
          let targetNodeId: string | null = null;
          if (spec.type === "model" && nodeIds.has(`model:${spec.targetComponent}`)) {
            targetNodeId = `model:${spec.targetComponent}`;
          } else if (spec.type === "policy" && nodeIds.has(`policy:${spec.targetComponent}`)) {
            targetNodeId = `policy:${spec.targetComponent}`;
          } else if (spec.type === "service" && nodeIds.has(`service:${spec.targetComponent}`)) {
            targetNodeId = `service:${spec.targetComponent}`;
          } else if (spec.type === "job" && nodeIds.has(`job:${spec.targetComponent}`)) {
            targetNodeId = `job:${spec.targetComponent}`;
          } else {
            // Check controller by partial match
            const ctrlNode = nodes.find((n) => n.type === "CONTROLLER" && (n.name.includes(spec.targetComponent!) || spec.targetComponent!.includes(n.name)));
            if (ctrlNode) targetNodeId = ctrlNode.id;
          }

          if (targetNodeId) {
            addEdge({
              edgeId: `${specNodeId}->TESTS->${targetNodeId}`,
              source: specNodeId,
              target: targetNodeId,
              type: "TESTS",
              confidence: "HIGH",
              evidence: {
                file: spec.file,
                symbol: spec.targetComponent,
                rule: "RSpec convention mapping",
                reason: `Test spec ${spec.file} tests component ${targetNodeId}`
              }
            });

            addEdge({
              edgeId: `${targetNodeId}->COVERS->${specNodeId}`,
              source: targetNodeId,
              target: specNodeId,
              type: "COVERS",
              confidence: "HIGH",
              evidence: {
                file: spec.file,
                symbol: spec.targetComponent,
                rule: "RSpec inverse coverage",
                reason: `Component ${targetNodeId} is covered by test spec ${spec.file}`
              }
            });
          }
        }
      }
    }

    return {
      graphVersion: 1,
      generatedAt: new Date().toISOString(),
      nodes,
      edges
    };
  }
}
