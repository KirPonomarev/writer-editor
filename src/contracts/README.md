# Contracts (Source of Truth)

## Purpose
`src/contracts/*` is the single source of truth for **public contracts** (types/shapes) shared across layers.

## Rules
- Public contracts MUST live in `src/contracts/*`.
- CORE may depend on `src/contracts/*`.
- `src/contracts/*` MUST NOT depend on CORE (`src/core/*`) or any platform/runtime code.
- No side effects, no runtime logic: contracts are types/shapes only.

## Scope
- Public, stable shapes: commands/events/state snapshots/IO request-response shapes.
- Platform adapters implement behavior elsewhere; contracts only define expectations.

## Notes
- CORE-internal helper types may exist in `src/core/*`, but are not considered public contracts.
- Moving existing shapes into `src/contracts/*` is a separate, explicit task.

## Naming
- Public contract files MUST be named `*.contract.ts`.

## Export surface
- Every public contract MUST be re-exported from `src/contracts/index.ts`.
- `src/contracts/index.ts` MUST remain free of runtime logic.

## Current contracts
- `core-command.contract.ts`
- `core-event.contract.ts`
- `core-state.contract.ts`
- `scene-document.contract.ts`
- `scene-block.contract.ts`
- `scene-inline-range.contract.ts`
- `runtime` barrel with:
  - `runtime-execution.contract.ts`
  - `runtime-effects.contract.ts`
  - `runtime-queue.contract.ts`
  - `runtime-trace.contract.ts`

## Out of minimal root barrel
- `dialog-port.contract.ts`
- `filesystem-port.contract.ts`
- `platform-info-port.contract.ts`
