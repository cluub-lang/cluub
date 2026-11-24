---
name: release
description: Release a new version of Cluub - version bump, changelog, npm publish of cluub and create-cluub, git tag, docs. Use when asked to cut or prepare a release.
---

# Release Cluub

Prepare everything; the publish steps need the maintainer's npm account and explicit approval.

1. Clean `main`, up to date; `npm test` prints "All good"; CI green (`gh run list -R cluub-lang/cluub`).
2. Choose the version (SemVer): fix → patch, feature → minor, breaking language change → major.
3. Update `package.json` and `packages/create-cluub/package.json` (version and its `cluub` dependency range).
4. Move `[Unreleased]` in `docs/changelog.md` under the new version with today's date.
5. Commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`.
6. Dry run: `npm pack` in both folders, install the tarballs in an empty folder, run `npx create-cluub demo` and `npm test` there.
7. With approval: `npm publish` (root, first), then `cd packages/create-cluub && npm publish`; `git push --follow-tags`; `gh release create vX.Y.Z --notes-from-tag` or with the changelog section.
8. The docs site republishes automatically on push to `main`.
