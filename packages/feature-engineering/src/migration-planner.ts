import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, DatabaseChangePlan, MigrationPlan, RollbackPlan, RollbackStep } from "./types.js";

export class MigrationPlanner {
  public static planMigration(
    definition: ResolvedCapabilityDefinition,
    pattern: CodePattern
  ): { migrationPlan: MigrationPlan; rollbackPlan: RollbackPlan } {
    const versionTag = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const railsVersion = pattern.migrations.railsVersion || "8.0";
    const isUuid = pattern.models.idType === "uuid";
    const idTypeOpt = isUuid ? ', id: :uuid' : '';
    const tenantKey = pattern.models.tenantKey;
    const tenantRefType = isUuid ? 'type: :uuid' : 'type: :bigint';

    if (definition.id === "webhooks") {
      const databaseChanges: DatabaseChangePlan[] = [
        {
          table: "webhook_endpoints",
          operation: "CREATE_TABLE",
          columns: [
            { name: "id", type: isUuid ? "uuid" : "bigint", null: false, unique: true },
            { name: tenantKey, type: isUuid ? "uuid" : "bigint", null: false, index: true },
            { name: "url", type: "string", null: false },
            { name: "description", type: "string" },
            { name: "encrypted_secret", type: "string", null: false },
            { name: "events", type: "text[]", default: [] },
            { name: "active", type: "boolean", default: true, null: false, index: true },
            { name: "disabled_at", type: "datetime" },
            { name: "created_at", type: "datetime", null: false },
            { name: "updated_at", type: "datetime", null: false }
          ],
          foreignKeys: [
            { column: tenantKey, toTable: tenantKey.replace("_id", "s") }
          ],
          indexes: [
            { columns: [tenantKey, "active"] }
          ]
        },
        {
          table: "webhook_deliveries",
          operation: "CREATE_TABLE",
          columns: [
            { name: "id", type: isUuid ? "uuid" : "bigint", null: false, unique: true },
            { name: "webhook_endpoint_id", type: isUuid ? "uuid" : "bigint", null: false, index: true },
            { name: "event_type", type: "string", null: false },
            { name: "payload", type: "jsonb", default: {}, null: false },
            { name: "status", type: "string", default: "pending", null: false, index: true },
            { name: "created_at", type: "datetime", null: false },
            { name: "updated_at", type: "datetime", null: false }
          ],
          foreignKeys: [
            { column: "webhook_endpoint_id", toTable: "webhook_endpoints", onDelete: "cascade" }
          ],
          indexes: [
            { columns: ["webhook_endpoint_id", "created_at"] },
            { columns: ["status"] }
          ]
        },
        {
          table: "webhook_attempts",
          operation: "CREATE_TABLE",
          columns: [
            { name: "id", type: isUuid ? "uuid" : "bigint", null: false, unique: true },
            { name: "webhook_delivery_id", type: isUuid ? "uuid" : "bigint", null: false, index: true },
            { name: "response_status", type: "integer" },
            { name: "duration_ms", type: "integer" },
            { name: "error_message", type: "text" },
            { name: "created_at", type: "datetime", null: false }
          ],
          foreignKeys: [
            { column: "webhook_delivery_id", toTable: "webhook_deliveries", onDelete: "cascade" }
          ],
          indexes: [
            { columns: ["webhook_delivery_id"] }
          ]
        }
      ];

      const migrationName = "CreateOutgoingWebhooksTables";
      const filename = `${versionTag}_create_outgoing_webhooks_tables.rb`;
      const targetPath = `db/migrate/${filename}`;

      const rubyCode = `# frozen_string_literal: true

class CreateOutgoingWebhooksTables < ActiveRecord::Migration[${railsVersion}]
  def change
    create_table :webhook_endpoints${idTypeOpt} do |t|
      t.references :${tenantKey.replace("_id", "")}, null: false, foreign_key: true, ${tenantRefType}
      t.string :url, null: false
      t.string :description
      t.string :encrypted_secret, null: false
      t.text :events, array: true, default: []
      t.boolean :active, default: true, null: false
      t.datetime :disabled_at

      t.timestamps
    end
    add_index :webhook_endpoints, [:${tenantKey}, :active]

    create_table :webhook_deliveries${idTypeOpt} do |t|
      t.references :webhook_endpoint, null: false, foreign_key: { on_delete: :cascade }, ${isUuid ? 'type: :uuid' : 'type: :bigint'}
      t.string :event_type, null: false
      t.jsonb :payload, default: {}, null: false
      t.string :status, default: "pending", null: false

      t.timestamps
    end
    add_index :webhook_deliveries, [:webhook_endpoint_id, :created_at]
    add_index :webhook_deliveries, :status

    create_table :webhook_attempts${idTypeOpt} do |t|
      t.references :webhook_delivery, null: false, foreign_key: { on_delete: :cascade }, ${isUuid ? 'type: :uuid' : 'type: :bigint'}
      t.integer :response_status
      t.integer :duration_ms
      t.text :error_message

      t.datetime :created_at, null: false
    end
    add_index :webhook_attempts, :webhook_delivery_id
  end
end
`;

      const rollbackSteps: RollbackStep[] = [
        {
          stepNumber: 1,
          name: "Rollback Migration via Rails",
          description: "Revert migration using Rails migration rollback command.",
          command: "bundle exec rails db:rollback STEP=1",
          riskLevel: "LOW"
        },
        {
          stepNumber: 2,
          name: "Direct Table Drop (Emergency Fallback)",
          description: "Drop created tables in reverse dependency order if migration rollback is locked.",
          rubyCode: "ActiveRecord::Base.connection.execute('DROP TABLE IF EXISTS webhook_attempts, webhook_deliveries, webhook_endpoints CASCADE;')",
          riskLevel: "MEDIUM"
        }
      ];

      const rollbackPlan: RollbackPlan = {
        strategy: "MIGRATION_DOWN",
        steps: rollbackSteps,
        dataLossRisk: "LOW (new tables only; no pre-existing domain data affected).",
        safeRollbackGuaranteed: true
      };

      return {
        migrationPlan: {
          migrationName,
          versionTag,
          filename,
          targetPath,
          rubyCode,
          changes: databaseChanges,
          reversible: true
        },
        rollbackPlan
      };
    }

    // Generic capability migration plan
    const tableName = definition.id.toLowerCase();
    const migrationName = `Create${definition.name.replace(/\s+/g, "")}Tables`;
    const filename = `${versionTag}_create_${tableName}_tables.rb`;
    const targetPath = `db/migrate/${filename}`;

    const databaseChanges: DatabaseChangePlan[] = [
      {
        table: tableName,
        operation: "CREATE_TABLE",
        columns: [
          { name: "id", type: isUuid ? "uuid" : "bigint", null: false },
          { name: tenantKey, type: isUuid ? "uuid" : "bigint", null: false },
          { name: "created_at", type: "datetime", null: false },
          { name: "updated_at", type: "datetime", null: false }
        ],
        foreignKeys: [{ column: tenantKey, toTable: tenantKey.replace("_id", "s") }],
        indexes: [{ columns: [tenantKey] }]
      }
    ];

    const rubyCode = `# frozen_string_literal: true

class ${migrationName} < ActiveRecord::Migration[${railsVersion}]
  def change
    create_table :${tableName}${idTypeOpt} do |t|
      t.references :${tenantKey.replace("_id", "")}, null: false, foreign_key: true, ${tenantRefType}
      t.timestamps
    end
  end
end
`;

    const rollbackPlan: RollbackPlan = {
      strategy: "MIGRATION_DOWN",
      steps: [
        {
          stepNumber: 1,
          name: "Rollback Migration",
          description: "Execute rails db:rollback STEP=1",
          command: "bundle exec rails db:rollback STEP=1",
          riskLevel: "LOW"
        }
      ],
      dataLossRisk: "LOW",
      safeRollbackGuaranteed: true
    };

    return {
      migrationPlan: {
        migrationName,
        versionTag,
        filename,
        targetPath,
        rubyCode,
        changes: databaseChanges,
        reversible: true
      },
      rollbackPlan
    };
  }
}
