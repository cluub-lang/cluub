# Security policy

## Supported versions

Cluub is a prototype (0.x). Security fixes are made on the latest release on `main`.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting: **Security → Report a vulnerability** on https://github.com/cluub-lang/cluub/security/advisories/new.

Include the affected version, a minimal `.clb` program or steps to reproduce, and the impact. We aim to acknowledge within 3 working days and to agree on a fix and disclosure timeline with you.

## Scope notes

Cluub never ships or proxies AI keys; keys are the user's own (`cluub ai set`, or end-user keys with `aiKeys "user"`). Cluub 0.x has no built-in authentication; see https://cluub-lang.github.io/guide/security for what is and isn't protected.
