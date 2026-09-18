# MCP Platform V5J — Release Receipts & Provenance Specification

## 1. Estrutura do `ReleaseReceipt`

```json
{
  "schema_version": 1,
  "receipt_type": "RELEASE_RECEIPT",
  "release_id": "rel_oest_a1b2c3d4_1789694900000",
  "product": "oest",
  "environment": "PRODUCTION",
  "artifact_digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "commit_sha": "a1b2c3d4e5f678901234567890abcdef12345678",
  "deployment_id": "dep_1789694900000_abcd",
  "change_plan_digest": "sha256:4ec514b9c6c387536ba094a98fdaf397bccb593ad9d5911d81c46d4dc73f07f9",
  "verification_digest": "sha256:vrf_digest_2222222222222222222222222222222222222222222222222222222222222222",
  "apply_id": "app_apply_3333333333333333",
  "git_operation_id": "git_op_555555",
  "ci_run_id": "ci_run_777777",
  "approval_id": "appr_rel_1789694900000_1234",
  "deployed_at": "2026-09-18T01:30:00.000Z",
  "verification_status": "PRODUCTION_VERIFIED",
  "diagnostic_snapshot_before": "sha256:snap_before_hash",
  "diagnostic_snapshot_after": "sha256:snap_after_hash",
  "receipt_digest": "sha256:..."
}
```
