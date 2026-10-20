# Agent instructions (MAALI)

## Karpathy coding guidelines

Bias toward caution over speed on non-trivial work.

### Think before coding

- State assumptions; ask if uncertain.
- Present multiple interpretations — do not pick silently.
- Say so if a simpler approach exists.
- If unclear, stop and ask.

### Simplicity first

- Minimum code for the request; nothing speculative.
- No extra features, abstractions, or config unless asked.
- If 200 lines could be 50, simplify.

### Surgical changes

- Touch only what the request requires; match existing style.
- Do not refactor unrelated code.
- Remove orphans only from your own changes.

### Goal-driven execution

- Use verifiable success criteria (tests, repro, before/after).
- Multi-step: `step -> verify: [check]` per step.
