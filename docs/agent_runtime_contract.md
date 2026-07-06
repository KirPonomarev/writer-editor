# Agent Runtime Contract V1

Status: router-lite phase 0. This is a development-only contract for bounded
cheap-worker delegation. It must not change the desktop app runtime, data
truth, storage model, or offline-first product behavior.

## Purpose

Reduce expensive orchestrator and full-history agent work without lowering
evidence quality.

- Deterministic tools run before LLM delegation.
- The main Codex orchestrator keeps architecture, canon, integration, delivery,
  and final repository judgment.
- Cheap workers receive only small stage packets, never the full thread or full
  repository history.
- Cheap worker output is advisory until verified by deterministic checks.

## Roles

| Role | Scope | Authority |
|---|---|---|
| `global_orchestrator` | Main Codex thread | Architecture, canon, integration, delivery, final judgment |
| `scoped_worker` | DeepSeek or another cheap model | Packet-only scout, summary, draft, or audit |

No scoped worker can approve canon, decide release readiness, commit, push,
merge, write authoritative ledgers, access secrets, or make final claims.

## Runtime Rules

- Default GPT subagents: `0`.
- Maximum expensive subagents per stage: `1`.
- Nested delegation is forbidden.
- Full-history delegation is forbidden.
- Packet size target: 3k-8k tokens.
- The app runtime remains offline-first. Router scripts may use network only
  when explicitly executed by the development runner and gated by policy.
- API keys are read only from environment or local keychain. Secrets are never
  written to repository files or reports.

## Allowed Cheap Worker Tasks

- read-only scout;
- artifact or plan summary;
- JSON, log, and report digest;
- contradiction scan;
- scoped test draft;
- scoped boilerplate or small code draft;
- simple diff sanity review;
- adversarial review of a bounded diff.

## Forbidden Cheap Worker Tasks

- final canon verdict;
- release or promotion decision;
- product runtime network path;
- app storage mutation;
- secret handling;
- operator approval;
- commit, push, PR, or merge;
- whole-repo full-history reasoning.

## Acceptance Gate

Cheap worker output is accepted only after:

- JSON contract validation;
- budget gate check;
- git diff review;
- exact file and line verification for claims;
- relevant syntax checks;
- relevant unit or contract tests;
- one negative test for the main risk when applicable.
