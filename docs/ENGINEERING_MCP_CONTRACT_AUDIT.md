# MCP Platform V5 — Engineering MCP Contract Audit

## 1. Executive Summary

Este documento estabelece a auditoria exaustiva dos contratos públicos reais, esquemas, tipos, serviços e dependências de todos os motores V5 da `@mcp-platform`. O objetivo é fundamentar a implementação do novo servidor MCP `apps/engineering-mcp` (`@mcp-platform/engineering-mcp`), garantindo que nenhuma API seja inventada ou simulada e que todas as ferramentas MCP sejam adaptadores diretos sobre a infraestrutura real e testada existente.

---

## 2. Auditoria dos Pacotes V5 e Exportações Públicas Reais

### 2.1 `@mcp-platform/repository-intelligence`
- **Serviços / Classes Principais**:
  - `RepositoryScanner.scan(repoRoot: string): Promise<RepositoryManifest>`
  - `ProductWorkspaceScanner.scanWorkspace(workspaceRoot: string): Promise<ProductWorkspace>`
  - `RepositoryRootValidator.validate(rootPath: string): Promise<RepositoryValidationResult>`
  - `UnsafeFilePolicy.isSafePath(targetPath: string, rootPath: string): boolean`
  - `UnsafeFilePolicy.isIgnored(filePath: string): boolean`
  - `SecretDetector.scanLine(line: string, lineNum: number, filePath: string): SecretFinding | null`
- **Modelos e Tipos Principais**:
  - `RepositoryManifest`, `ProductWorkspace`, `RepositoryValidationResult`, `Evidence`, `ScanCoverage`, `RouteDefinition`, `ModelDefinition`, `ControllerDefinition`, `PolicyDefinition`, `ServiceDefinition`, `JobDefinition`, `AdminResourceDefinition`, `NextRouteDefinition`, `TableDefinition`, `SecretFinding`.
- **Natureza Operacional**: Somente Leitura (Read-Only).

### 2.2 `@mcp-platform/architecture-graph`
- **Serviços / Classes Principais**:
  - `ArchitectureGraphBuilder.build(manifest: RepositoryManifest): ArchitectureGraphData`
  - `ArchitectureGraphBuilder.buildFromWorkspace(workspace: ProductWorkspace): ArchitectureGraphData`
  - `ImpactAnalyzer(graph: ArchitectureGraphData)`:
    - `getNode(id: string): ArchitectureNode | undefined`
    - `whyEdge(edgeId: string): ArchitectureEdge["evidence"] | undefined`
    - `whatUsesModel(modelName: string): ArchitectureNode[]`
    - `whatProtectsController(controllerName: string): ArchitectureNode[]`
    - `whatTestsProtectComponent(componentId: string): ArchitectureNode[]`
    - `whatTablesAreAffected(modelName: string): ArchitectureNode[]`
    - `getDownstreamDependencies(nodeId: string): ArchitectureNode[]`
    - `getUpstreamDependents(nodeId: string): ArchitectureNode[]`
- **Modelos e Tipos Principais**:
  - `ArchitectureGraphData`, `ArchitectureNode`, `ArchitectureEdge`, `ArchitectureNodeType`, `ArchitectureEdgeType`, `EdgeEvidence`.
- **Natureza Operacional**: Somente Leitura e Análise em Memória (Read-Only).

### 2.3 `@mcp-platform/saas-gap-analyzer`
- **Serviços / Classes Principais**:
  - `GapEngine.analyze(manifest: RepositoryManifest, graph: ArchitectureGraphData): GapReport`
  - `GapEngine.analyzeWorkspace(workspace: ProductWorkspace, graph: ArchitectureGraphData): GapReport`
  - `GapReportGenerator.generateMarkdown(report: GapReport): string`
- **Modelos e Tipos Principais**:
  - `GapReport`, `CapabilityAudit`, `RequirementAudit`, `CapabilityStatus`, `RequirementSeverity`, `GapPriority`.
- **Natureza Operacional**: Somente Leitura e Diagnóstico Arquitetural (Read-Only).

### 2.4 `@mcp-platform/feature-engineering`
- **Serviços / Classes Principais**:
  - `FeatureEngineeringEngine.plan(manifest: RepositoryManifest, graph: ArchitectureGraphData, gapReport: GapReport, options?: FeatureEngineeringOptions): FeatureEngineeringResult`
  - `FeatureEngineeringEngine.planWorkspace(workspace: ProductWorkspace, graph: ArchitectureGraphData, gapReport: GapReport, options?: FeatureEngineeringOptions): FeatureEngineeringResult`
  - `VerticalSlicePlanner.plan(...)`: Gera `VerticalSlicePlan` com base em padrões existentes e invariantes arquiteturais.
  - `ChangePlanner.planChanges(...)`: Gera `ChangePlan` declarativo (operações planejadas, sem escrita em disco).
  - `PlanReporter.generateMarkdown(...)`: Gera relatório auditável em Markdown.
- **Modelos e Tipos Principais**:
  - `FeatureEngineeringResult`, `VerticalSlicePlan`, `ChangePlan`, `PlannedOperation`, `FeatureEngineeringOptions`.
- **Natureza Operacional**: Planejamento Determinístico em Memória (PLAN_ONLY / Sem Mutação).

### 2.5 `@mcp-platform/verification-engine`
- **Serviços / Classes Principais**:
  - `VerificationEngine.verify(request: VerificationRequest): Promise<VerificationResult>`
  - `BlastRadiusAnalyzer.analyze(graph: ArchitectureGraphData, slicePlan: VerticalSlicePlan): BlastRadius`
  - `ChangeSurfaceAnalyzer.analyze(changePlan: ChangePlan): ChangeSurface`
  - `WorkspaceVerifier.captureRevision(rootPath: string): RepositoryRevision`
- **Modelos e Tipos Principais**:
  - `VerificationRequest`, `VerificationResult`, `VerificationReport`, `VerificationReceipt`, `BlastRadius`, `ChangeSurface`, `RepositoryRevision`, `CheckResult`.
- **Natureza Operacional**: Verificação Estática e Geração de Recibo Criptográfico (PLAN / READ).

### 2.6 `@mcp-platform/apply-engine`
- **Serviços / Classes Principais**:
  - `ApplyEngine.apply(request: ApplyRequest): Promise<ApplyResult>`
  - `ReceiptChainValidator.validate(...)`: Valida a cadeia criptográfica de aprovação e verificação.
  - `WorkspaceLock.acquire / release`: Concorrência com trava atômica.
  - `WorkspaceSnapshotManager.createSnapshot / cleanSnapshot`: Snapshot byte a byte para rollback.
  - `RollbackManager.executeRollback(...)`: Execução e verificação de integridade pós-rollback.
  - `DiffValidator.validate(...)`: Confronta a superfície planejada com a superfície real aplicada.
- **Modelos e Tipos Principais**:
  - `ApplyRequest`, `ApplyResult`, `ApplyReport`, `ApplyReceipt`, `ApprovalReceipt`, `RollbackVerificationReport`, `WorkspaceSnapshotData`, `MutationJournal`.
- **Natureza Operacional**: Mutação Transacional Controlada com Suporte a Dry Run (WRITE / HIGH_RISK).

### 2.7 `@mcp-platform/git-governance`
- **Serviços / Classes Principais**:
  - `GitGovernanceEngine.execute(request: GitGovernanceRequest): Promise<GitGovernanceResult>`
  - `GitClient(workspaceRoot)`: Execução estrita de subcomandos git aprovados via `execFile` e política de sanitização de credenciais.
  - `BranchManager.createIsolatedBranch(...)`: Criação de branch isolada com validação contra branches protegidas.
  - `StagingManager.stageSelective(...)`: Staging seletivo apenas de arquivos declarados.
  - `CommitManager.createGovernedCommit(...)`: Commit com metadados estruturados e verificação pós-commit.
  - `DiffParser`, `DiffClassifier`, `SecretDiffScanner`: Classificação de diff e varredura de segredos.
- **Modelos e Tipos Principais**:
  - `GitGovernanceRequest`, `GitGovernanceResult`, `GitReport`, `GitReceipt`, `GitApprovalReceipt`, `DiffReport`, `CommitReport`, `PushReport`, `PRPlan`, `PRReport`.
- **Natureza Operacional**: Governança Git e Mutação Transacional de Repositório (WRITE / HIGH_RISK).

### 2.8 `@mcp-platform/production-diagnostics`
- **Serviços / Classes Principais**:
  - `DiagnosticsEngine.diagnose(request: DiagnosticsRequest): Promise<DiagnosticsResult>`
  - `LogCollector`, `ErrorCollector`, `MetricCollector`, `DeploymentCollector`, `HealthCollector`, `DatabaseCollector`, `RedisCollector`, `SidekiqCollector`, `StorageCollector`.
  - `TemporalCorrelator`, `DeploymentCorrelator`, `ArchitectureCorrelator`.
  - `SymptomClassifier`, `HypothesisEngine`, `EvidenceChain`.
  - `DiagnosticsReportGenerator.generateMarkdown(result: DiagnosticsResult): string`.
- **Modelos e Tipos Principais**:
  - `DiagnosticsRequest`, `DiagnosticsResult`, `Incident`, `IncidentTimeline`, `DiagnosticSnapshot`, `DiagnosticsReceipt`, `DiagnosticHandoff`, `Observation`, `Symptom`, `RootCauseHypothesis`.
- **Natureza Operacional**: Coleta de Telemetria, Correlação e Diagnóstico com Redação de Segredos/PII (READ).

### 2.9 `@mcp-platform/safe-release`
- **Serviços / Classes Principais**:
  - `SafeReleaseEngine.executeRelease(request: SafeReleaseRequest): Promise<SafeReleaseResult>`
  - `ReleaseCandidateBuilder.build(...)`: Constrói e valida proveniência de Release Candidate.
  - `DeploymentPlanBuilder.createPlan(...)`: Planeja etapas de deployment e canário.
  - `ProductionVerifier.verify(...)`: Verifica probes de integridade em produção e correspondência de digest.
  - `RollbackController.executeRollback(...)`: Executa rollback para release conhecida estável com recibo.
- **Modelos e Tipos Principais**:
  - `SafeReleaseRequest`, `SafeReleaseResult`, `ReleaseCandidate`, `DeploymentPlan`, `ReleaseReceipt`, `RollbackReceipt`, `KnownGoodRelease`, `ProductionVerification`.
- **Natureza Operacional**: Planejamento, Verificação em Produção e Rollback de Release (PLAN / WRITE / HIGH_RISK).

---

## 3. Matriz de Mapeamento das Ferramentas MCP

| Categoria | Nome da Ferramenta MCP | Motor Responsável | Classificação | Risco | Mutação de Disco |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Discovery** | `engineering_get_platform_info` | `@mcp-platform/core` + Metadados dos 9 Motores V5 | READ | Baixo | Não |
| **Discovery** | `engineering_list_capabilities` | Registro Unificado dos Motores V5 | READ | Baixo | Não |
| **Repository Intelligence** | `engineering_scan_repository` | `RepositoryScanner` / `ProductWorkspaceScanner` | READ | Baixo | Não |
| **Repository Intelligence** | `engineering_get_repository_evidence` | `RepositoryRootValidator` / `RepositoryScanner` | READ | Baixo | Não |
| **Architecture** | `engineering_build_architecture_graph` | `ArchitectureGraphBuilder` / `ImpactAnalyzer` | READ | Baixo | Não |
| **Gap Analysis** | `engineering_analyze_saas_gaps` | `GapEngine` / `GapReportGenerator` | READ | Baixo | Não |
| **Feature Engineering** | `engineering_plan_feature` | `FeatureEngineeringEngine` | PLAN | Médio | Não |
| **Verification** | `engineering_analyze_blast_radius` | `BlastRadiusAnalyzer` / `ImpactAnalyzer` | PLAN | Baixo | Não |
| **Verification** | `engineering_verify_change` | `VerificationEngine` | PLAN | Médio | Não |
| **Controlled Apply** | `engineering_preview_apply` | `ApplyEngine` (dryRun=true) | PLAN | Médio | Não |
| **Controlled Apply** | `engineering_apply_change` | `ApplyEngine` (com Receipt Chain e Locks) | WRITE | HIGH_RISK | Sim (Transacional) |
| **Controlled Apply** | `engineering_rollback_apply` | `RollbackManager` | WRITE | HIGH_RISK | Sim (Restauração) |
| **Git Governance** | `engineering_git_status` | `GitClient` | READ | Baixo | Não |
| **Git Governance** | `engineering_prepare_branch` | `BranchManager` | WRITE | Médio | Sim (Git State) |
| **Git Governance** | `engineering_prepare_commit` | `GitGovernanceEngine` / `CommitManager` | WRITE | HIGH_RISK | Sim (Git Commit) |
| **Production Diagnostics**| `engineering_diagnose_production` | `DiagnosticsEngine` | READ | Baixo | Não |
| **Safe Release** | `engineering_release_plan` | `DeploymentPlanBuilder` / `ReleaseCandidateBuilder` | PLAN | Médio | Não |
| **Safe Release** | `engineering_verify_release` | `ProductionVerifier` / `SafeReleaseEngine` | PLAN | Alto | Não |
| **Safe Release** | `engineering_rollback_release`| `RollbackController` | WRITE | HIGH_RISK | Sim (Infra/Release) |

---

## 4. Políticas de Segurança e Fronteira de Repositório

1. **Validação Canônica de Caminhos**:
   - Todo caminho fornecido é resolvido com `path.resolve`.
   - Rejeição de `../`, symlinks que escapam a raiz, caminhos UNC inválidos e caminhos de outros drives.
   - Aplicação de `UnsafeFilePolicy` e bloqueio de arquivos sensíveis do sistema (`.ssh`, `id_rsa`, `master.key`, `.gnupg`, etc.).
2. **Proteção contra Mutação sem Aprovação**:
   - Operações `WRITE` e `HIGH_RISK` exigem `approval_receipt` / token assinado, com digest correspondente ao plano de alteração e validação de nonce/replay.
3. **Isolamento de STDOUT**:
   - Comunicação JSON-RPC exclusiva via STDOUT.
   - Logs estritamente canalizados para STDERR via `ConsoleLogger` com redação de segredos.
