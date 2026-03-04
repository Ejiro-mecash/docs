# Lessons Learned

Log technical patterns, pitfalls, and improvements here to avoid repeat mistakes.

## [2026-02-27] Workflow Setup
- **Pattern**: When a user provides a Gist for "codebase addition", clarify if it's for documentation or internal agent tools.
- **Lesson**: Agent-specific workflows should be placed in `.agent/workflows` to be automatically picked up by the system.
