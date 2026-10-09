@AGENTS.md

# Subagent model selection

When spawning a subagent, choose the model and reasoning effort that fit the task
instead of inheriting the session model. Always set both explicitly on the spawn.

| Task | Model | Effort |
| --- | --- | --- |
| File/keyword search, listing, hash or identity checks, running a known test command and reporting the result | `haiku` | `low` |
| Routine implementation, focused bug fixes, test writing, doc updates, codebase mapping | `sonnet` | `medium` |
| Independent code/security review, plan checking, verification, debugging with an unknown cause, architecture and phase planning | `opus` | `medium` |
| Reviews or changes touching publication/transaction guards, frozen budgets, server authority or netcode | `opus` | `high` |

- If an agent definition pins its own model, that pin wins.
- Pick the cheaper row when a task fits two rows, and move up one row only if the
  first result is thin or wrong.
- State the chosen model and effort in one line when reporting that an agent started.
- An explicit model or effort in a user request overrides this table.
