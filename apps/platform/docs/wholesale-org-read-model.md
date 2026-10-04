# Wholesale org read model (Timeweb LK migration)

## Sources

| Field / concept | Source table / path |
|-----------------|---------------------|
| Client card | `wholesale_client_metadata.raw` |
| Holding link state | `wholesale_client_metadata.holding_link_state`, `pending_holding_guid` |
| Manager roster state | `wholesale_client_metadata.manager_roster_state` |
| Outlet details | `wholesale_outlet_metadata.raw`, `closed` |
| Employee roster (42 OPT) | `wholesale_source_snapshots.raw.employeeRoster`, fallback `exchange_users_raw` |
| Denormalized names | `exchange_legals_raw` (used by MVs, not for GUID matching) |

## Assignment GUIDs (client)

- `guid_head_of_the_sales_department` → ROP grouping
- `guid_manager` → responsible manager
- `guid_regional_manager` → regional manager (filter/card only, not hierarchy level)
- `guid_hardware_manager` → hardware manager (filter/card only)
- Store managers: `wholesale_outlet_metadata.raw.managers` (separate from client block)

Matching is **GUID-only**. Same FIO with different GUIDs are different employees.

## Scope rules

- **Admin / director / analyst**: full catalog via `db-scope-formula` `full_catalog`; org structure from wholesale when LK `teams` empty.
- **Employee preview (admin)**: session columns `employee_preview_guid`, `employee_preview_assignment`; scope computed server-side from wholesale assignments; read-only.
- Missing LK account does **not** hide employee or assignments from admin.

## Counters

Unique clients by `guid_client`. Stores by `guid_store`. Client may appear under multiple ROP/manager views; org total uses unique sets, not sum of overlapping groups.

## Preview vs impersonation

| | Impersonation | Employee preview |
|---|---------------|------------------|
| Target | Active LK user | 1C employee GUID from roster |
| Session | Switches `user_id` | Keeps admin user, stores preview on session |
| Writes | Blocked | Blocked (`LK_MIGRATION_READ_ONLY`) |
| UI | Standard session | Banner «Предпросмотр сотрудника» |

Preview does not grant future account permissions and is not nested with impersonation.
