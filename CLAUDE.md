# CLAUDE.md

## Git

Always commit with `--no-gpg-sign` — GPG signing is not configured in this container.

## Development Environment

This project runs inside a devcontainer (`.devcontainer/`). The container is locked down with an iptables firewall that only allows traffic to a small allowlist of domains.

- **To install system packages or tools** — edit `.devcontainer/Dockerfile` and rebuild the container.
- **To allow network access to a new domain** — add it to the domain list in `.devcontainer/init-firewall.sh`.

## Tooling Philosophy

Always use the right tool for the job — install real libraries instead of reimplementing things with stdlib. If a dependency is missing and can't be installed due to the container/firewall setup, ask the user to help unblock it (e.g. add a domain to the firewall, add a package to the Dockerfile, rebuild the container). Don't silently work around missing tools with inferior hand-rolled alternatives.

## Documentation

When adding or modifying a feature, always update the relevant documentation if it exists. Keep docs in sync with code.

## Code Style

Inspired by NASA/JPL's "Power of 10" — code must be quickly and easily reviewable by a human.

- Write minimal, concise code. No unnecessary abstractions or indirection.
- Functions should be short enough to fit on a screen (~60 lines max). If longer, split by responsibility.
- Simple control flow. Minimal nesting, early returns over deep if/else chains.
- Smallest possible scope for all variables and data.
- No comments unless the logic is genuinely non-obvious. Never restate what the code already says.
- No JSDoc unless it's a public API. Skip @param/@returns that just repeat type signatures.
- Don't add error handling, validation, or fallbacks for cases that can't realistically happen.
- Prefer fewer lines. Three similar lines are better than a helper function used once.
- Don't refactor, rename, or "improve" code you weren't asked to change.
- No clever tricks. Code should be obvious, not impressive.
