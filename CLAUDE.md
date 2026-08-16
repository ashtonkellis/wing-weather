# wing-weather

Weather aggregation tool.

## Workflow: feature todo list

We track feature work in `TODO.md`, which has a **To Do** section and a
**Done** section.

- When the user makes a feature request, add it as an item under **To Do**.
- When a feature is complete, move its item from **To Do** to **Done**.

Keep `TODO.md` current as part of doing the work — updating it is not a
separate step to wait for.

## Workflow: push only when the To Do list is empty

Don't push to GitHub after every individual change. Keep working (committing
locally is fine) and only **push when the `TODO.md` To Do section is empty** —
i.e. all requested work is done. Then push once. A "deploy" is a push, so the
version-bump step below applies to that push, not to each intermediate change.

## Workflow: app version on every deploy

The app shows its version in the footer. It is a single source of truth in
`js/config.js` as `WW_CONFIG.version` (e.g. `"9"`), rendered as `v<version>`.

On **every deploy** (any fix or feature that ships to GitHub Pages):

1. Bump `WW_CONFIG.version` in `js/config.js`.
2. Keep the service-worker cache in sync: set `sw.js` `CACHE` to
   `"wing-weather-v<version>"` (same number). This also busts the SW cache so
   returning visitors update.
3. After pushing, **tell the user which version they should see** in the
   footer, so they can confirm the update reached their phone (they may need
   to reopen the app once to pick up the new service worker).

Bump the version by 1 each deploy unless the user asks for a different scheme.
