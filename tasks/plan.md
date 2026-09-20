# Implementation Plan: Per-trip People (who paid)

## Overview
Add a per-trip list of people ("members"). Every expense can optionally be assigned
to one member via a "Paid by" selector in the expense sheet. People are configured in
the Settings tab. The Expenses tab shows a small per-person "spent so far" breakdown and
each expense row shows the payer's avatar.

## Architecture Decisions
- **Scope: per-trip.** `trip_members` table owns rows per trip, cascade-deleted with the trip.
- **Optional assignment.** `expenses.person_id` is nullable; empty means unassigned.
- **Delete protection.** Deleting a member unassigns it from all referencing expenses
  (sets `person_id` to NULL in one transaction, then removes the row) instead of blocking.
- **Stable color per member** assigned server-side from a shared palette
  (`MEMBER_COLORS` in `shared/types.ts`), stored in the DB.
- **Members included in trip export** alongside expenses.
- Expense summary shows all members (0 included) plus an "Unassigned" row only when
  unassigned spend exists, so numbers reconcile with the totals.

## Task List

### Phase 1: Backend
- [ ] Task 1: Shared types + migration + db layer (trip_members, expenses.person_id, member CRUD, map personId)
- [ ] Task 2: Validation + API routes + export bundle + app tests

### Checkpoint: Backend
- [ ] `npm test` passes (incl. new member/expense-personId tests), typecheck clean

### Phase 2: Frontend
- [ ] Task 3: API client + store actions (members state, add/rename/remove, personId in expense payloads)
- [ ] Task 4: UI — ExpenseSheet "Paid by", Settings members manager, Expenses tab breakdown + avatars, Trip tab avatars, styles

### Checkpoint: Complete
- [ ] `npm test` + `npm run typecheck` + `npm run build` pass
- [ ] Manual: create member, assign expense, view breakdown, rename/delete member

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration on existing DBs | Med | Migration array append; `_meta.schema_version` bumps 1→2; existing dev db migrates on next start |
| Deleting a member with expenses | Med | Server blocks with 409 + clear message; UI shows toast |
| personId referencing another trip | Med | Belongs-to-trip check on expense create/patch |

## Open Questions
- None (per-trip scope confirmed with user).