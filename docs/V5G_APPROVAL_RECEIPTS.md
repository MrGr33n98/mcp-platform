# MCP PLATFORM V5G — APPROVAL RECEIPTS
## Cryptographic Approval Chain, Replay Protection & Scoped Permissions

---

### 1. Modelo de Recibo de Aprovação (`ApprovalReceipt`)

Diferente de flags booleanas triviais (`approval=true`), a Phase 5G exige um recibo estruturado e assinado criptograficamente:

```json
{
  "schema_version": 1,
  "approval_id": "APPR-20260917-CANARY",
  "approver_id": "user_lead_architect",
  "approver_type": "HUMAN_OPERATOR",
  "approved_at": "2026-09-17T21:00:00.000Z",
  "expires_at": "2026-09-17T22:00:00.000Z",
  "change_plan_digest": "e09a968b3b30875517bfaef31d910087a7eea9d8a6bbe624cbe225e324555eee",
  "verification_digest": "24bc57aba12435cabae1e8136d4dbe22546cd44a4ad46033f70bdb6cd2655ae8",
  "repository_revision": {
    "commitSha": "8326d3538a2f",
    "branch": "main",
    "dirty": false,
    "capturedAt": "2026-09-17T20:54:15.000Z"
  },
  "workspace_id": "oest_backend",
  "scope": {
    "entire_change_plan": true
  },
  "nonce": "nonce_7f8c9b2a1e_unique",
  "signature_or_mac": "3a8f9c1b7d5e..."
}
```

---

### 2. Autenticação e Assinatura Criptográfica

Para ambientes de desenvolvimento local (`DEV_LOCAL`), o `ReceiptChainValidator` calcula a assinatura usando HMAC-SHA256:

$$\text{MAC} = \text{HMAC-SHA256}(K, \text{schema\_version} \mathbin{\Vert} \text{approval\_id} \mathbin{\Vert} \text{approver\_id} \mathbin{\Vert} \text{approved\_at} \mathbin{\Vert} \text{expires\_at} \mathbin{\Vert} \text{plan\_digest} \mathbin{\Vert} \text{verification\_digest} \mathbin{\Vert} \text{commitSha} \mathbin{\Vert} \text{scope} \mathbin{\Vert} \text{nonce})$$

Para arquitetura de produção, a interface plugável `ApprovalAuthority` permite plugar autenticação assimétrica (ex: chaves públicas ECDSA/Ed25519, hardware tokens ou SSO OIDC).

---

### 3. Proteção contra Replay e Amarração de Escopo

1. **Proteção contra Replay:** Cada recibo contém um `nonce` único e um timestamp de expiração `expires_at`.
2. **Amarração Estrita de Escopo:** A aprovação pode especificar `entire_change_plan: true` ou uma lista restrita de operações `operations: ["OP-001", "OP-002"]`. O `ReceiptChainValidator` rejeita a aplicação se houver qualquer operação no plano que não esteja expressamente aprovada no escopo.
