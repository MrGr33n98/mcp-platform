# MCP Platform V5H — Git Receipts Specification

## 1. Estrutura do `GitApprovalReceipt`

O `GitApprovalReceipt` autoriza a execução controlada de passos Git com escopos granulares:

```json
{
  "schema_version": 1,
  "approval_id": "git_approval_canary_001",
  "approver_id": "lead_architect",
  "approver_type": "HUMAN_OPERATOR",
  "approved_at": "2026-09-17T21:40:00.000Z",
  "expires_at": "2026-09-17T22:40:00.000Z",
  "apply_id": "apply_tx_canary_001",
  "change_plan_digest": "digest_plan_12345",
  "verification_digest": "digest_verif_12345",
  "repository_revision": {
    "commitSha": "abc1234567890abcdef1234567890abcdef123456",
    "branch": "main",
    "dirty": false,
    "capturedAt": "2026-09-17T21:39:00.000Z"
  },
  "workspace_id": "ws_canary",
  "scope": {
    "scopes": ["CREATE_BRANCH", "STAGE", "COMMIT", "CREATE_PR"],
    "target_branch": "mcp/outgoing-webhooks/tx987654",
    "target_remote": "origin"
  },
  "nonce": "nonce_canary_e2e_1",
  "signature_or_mac": "3f98a76d1e4c9b820a56f..."
}
```

---

## 2. Estrutura do `GitReceipt`

O `GitReceipt` é o recibo emitido após a conclusão bem-sucedida da operação Git:

```json
{
  "schema_version": 1,
  "receipt_type": "GIT_RECEIPT",
  "git_operation_id": "git_op_1726618800000_a81c29",
  "repository": "oest",
  "source_revision": {
    "commitSha": "abc1234567890abcdef1234567890abcdef123456",
    "branch": "main",
    "dirty": false,
    "capturedAt": "2026-09-17T21:39:00.000Z"
  },
  "branch": "mcp/outgoing-webhooks/tx987654",
  "commit_sha": "def4567890abcdef1234567890abcdef12345678",
  "commit_diff_digest": "e4b2c1a890abcdef...",
  "change_plan_digest": "digest_plan_12345",
  "verification_digest": "digest_verif_12345",
  "apply_id": "apply_tx_canary_001",
  "push_status": "LOCAL_ONLY",
  "pr_status": "PR_CREATED",
  "status": "PR_CREATED",
  "timestamp": "2026-09-17T21:40:05.000Z"
}
```
