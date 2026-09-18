# V5 — Architecture Graph Specification

**Package:** `@mcp-platform/architecture-graph`  
**Purpose:** Graph-based representation of SaaS codebases with confidence ratings and verifiable evidence.

---

## 1. Node & Edge Taxonomy

### Node Types
`ROUTE`, `CONTROLLER`, `POLICY`, `SERVICE`, `MODEL`, `TABLE`, `MIGRATION`, `JOB`, `MAILER`, `ADMIN_RESOURCE`, `NEXT_ROUTE`, `NEXT_PAGE`, `COMPONENT`, `HOOK`, `API_CLIENT`, `QUEUE`, `CACHE`, `STORAGE`.

### Edge Types & Inferred Relationships
- `ROUTE` --- `ROUTES_TO` ---> `CONTROLLER`
- `CONTROLLER` --- `AUTHORIZES_WITH` ---> `POLICY`
- `POLICY` --- `AUTHORIZES_WITH` ---> `MODEL`
- `MODEL` --- `PERSISTS_TO` ---> `TABLE`
- `MODEL` --- `DEPENDS_ON` / `USES` ---> `MODEL`
- `ADMIN_RESOURCE` --- `USES` ---> `MODEL`
- `JOB` --- `ENQUEUES` ---> `QUEUE`

---

## 2. Confidence & Evidence Requirements

Every edge must contain:
1. `confidence`: `HIGH`, `MEDIUM`, or `LOW`.
2. `evidence`:
   - `file`: Exact file path.
   - `line`: Line number where relationship occurs.
   - `symbol`: Name of class/method/association.
   - `reason`: Concrete justification for edge creation.

---

## 3. Impact Analysis Queries

The `ImpactAnalyzer` provides:
- `whatUsesModel(modelName)`
- `whatProtectsController(controllerName)`
- `whatTablesAreAffected(modelName)`
- `getDownstreamDependencies(nodeId)`
- `getUpstreamDependents(nodeId)`
