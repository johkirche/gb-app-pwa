# Repo conventions

## Git

**Never squash commits.** Not when merging a branch, not when landing work on `dev` or
`main`, not to "tidy up" a series. Every commit that was written stays its own commit.

Squashing has already cost this repo real pain: `main` carries two squashed commits
(`4f2269f`, `7173797`) that reproduce eleven commits still living on `dev`. The trees are
byte-identical, but git no longer knows that — so any branch cut from `main` collides with
`dev` across the whole view layer in conflicts that are pure history artefacts, with the
"correct" resolution already sitting in both sides.

Merge or rebase, keep the individual commits, and let the history stay honest about what
happened.
