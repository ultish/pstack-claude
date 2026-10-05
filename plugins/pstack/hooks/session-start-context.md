You have pstack.

When the task is to produce or judge an engineering artifact, invoke the `pstack:poteto-mode` skill with the Skill tool and follow it before you start. That covers writing or changing code (a feature, bug fix, refactor, performance work, a prototype), writing a design doc, RFC, or plan, and reviewing code or a PR. Poteto-mode routes to the right playbook and principles from there. The principles apply to design and review work as much as to code, so don't skip it because nothing is being coded.

Skip it for a question about existing code or history. Answer those with `pstack:how` (how a subsystem works) or `pstack:why` (why it was built this way). Skip it for a trivial one-line edit. If the question is really the first step of a change ("how should we build X"), treat it as a change and use poteto-mode.

If you are already following poteto-mode, continue. Don't invoke it again.

Instructions from the user (CLAUDE.md, AGENTS.md, direct requests) override this. Other session hooks that set tool preferences, such as which search tool to use first, still apply inside poteto-mode.
