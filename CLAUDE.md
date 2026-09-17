# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-generated vegan recipe blog built with **Eleventy v3** and deployed to GitHub Pages at https://recipe.polente.de/. Recipes are generated daily via a cronjob using Gemini AI models (see FLOWCHART.md), then committed and auto-deployed.

## Commands

- **Dev server:** `npm run serve` (runs Eleventy + PostCSS in parallel with watch/live reload)
- **Production build:** `npm run build` (runs `build:files` + `build:styles` in parallel)
- **Clean dist:** `npm run clean`
- **Format:** `npx prettier --write .`
- Node version: v24.18.0 (see `.nvmrc`), matched by `NODE_VERSION` in both workflows. Hard floor
  is Node 22 (`@11ty/eleventy-img` v7); no dependency declares an upper bound.

## Architecture

### Eleventy Configuration (`eleventy.config.js`)
- Input: `src/`, Output: `dist/`, Data: `src/_11ty/data/`
- Template engines: Nunjucks (`.njk`, `.html`, `.md`), Markdown, `11ty.js`
- Plugins: navigation, RSS, syntax highlighting
- Custom markdown-it config with footnotes, sub/sup, deflists (`src/_11ty/libraries/markdown-it.js`)

### Key Directories under `src/`
- `_11ty/` — Eleventy extensions: collections, filters, shortcodes, transforms, data, libraries
- `_includes/layouts/` — Nunjucks page layouts (`base`, `post`, `list`, `page`, `index`, etc.)
- `_includes/partials/` — Reusable template fragments (header, footer, pagination, post list)
- `_styles/` — CSS source using PostCSS (custom media, custom selectors, extend rule, easy-import, cssnano)
- `content/posts/` — Recipe markdown files (frontmatter + Nunjucks shortcodes)
- `media/` — Recipe images (referenced by posts)
- `static/` — Passthrough assets (fonts, favicons, JS, robots.txt)

### Recipe Post Structure
Posts in `src/content/posts/` use a shared data file (`posts.json`) that sets:
- Layout: `layouts/post`
- Permalink: `/recipes/{{ page.fileSlug }}/`
- Navigation parent: `recipes`

Each post markdown has frontmatter with `title`, `description`, `tags`, and `figureRecipe` (image metadata). Body uses `{% figure %}` / `{% picture %}` shortcodes for responsive images (AVIF + JPEG via `@11ty/eleventy-img`).

### Filters (`src/_11ty/filters.js`)
- Date formatting filters (Luxon-based): `dateToDMY`, `dateToYYYYMMDD`, etc.
- `squash` — text processing for search index
- `extractRecipeData` — parses rendered HTML to extract structured recipe data (ingredients, instructions with step IDs, prep time, nutrition, yield) for JSON-LD schema
- `toJson` — safe JSON serialization

### Transforms (`src/_11ty/transforms.js`)
- `addStepIds` — injects `id="stepN"` attributes on instruction `<li>` elements for deep linking
- `htmlmin` — minifies HTML in production only (skipped during `serve`)

### Webmentions & consent
Recipe pages can display responses collected by webmention.io. Because that means the visitor's browser contacts a third party, it is gated behind explicit consent:

- `src/_includes/partials/consent-banner.njk` — included as the first child of `<body>` in `layouts/base.njk`. Ships `hidden`; its **inline, non-deferred** script reveals it before the header paints (deferring it would cause layout shift). Accepting writes the `wm-consent` cookie (`granted`/`denied`, 180 days, `SameSite=Lax`) and reloads; declining removes the mentions section. The footer's `[data-consent-reset]` button clears the cookie.
- `src/static/js/webmentions.js` — on post pages only. Reads the same cookie; unless it is `granted`, it removes `.webmentions` and stops. Otherwise it fetches `mentions.jf2` and renders.
- **Privacy rules baked into the renderer:** likes/reposts/bookmarks/RSVPs are a facepile of linked avatars, deduplicated per person per pile and capped at `MAX_FACES`; replies show name, date and *plain text*; `author.photo` is requested **only** when its host is exactly `avatars.webmention.io` (`photoUrl()` — anything else falls back to the CSS letter badge, so no new third party is ever contacted); reply content is never inserted as HTML.
- The live region is the `[data-webmentions-status]` line in `post.njk`, **not** `.webmentions__results` — announcing the results would read every name and reply body aloud.
- The mount point in `post.njk` uses `meta.canonicalDomain` (not `meta.domain`), so `serve` queries the production target instead of `localhost`.
- `src/content/privacy.md` documents all of the above for readers and must stay in sync.

### Microformats2
Posts are marked up as `h-entry` (`p-name`, `dt-published`, `e-content`, `u-url`, `p-summary`, `u-photo`, `p-category`) with a `p-author h-card` linking to the chef page. Listing pages (`list.njk`, `tag-results.njk`, `chef.njk`, `content/index.njk`, `layouts/index.njk`) use `h-feed` + `h-entry`. Chef page headers are `h-card`, and `site-footer.njk` carries the representative `h-card` for the domain. Values with no visible text use `<data class="…" value="…">`.

### CSS Pipeline
Entry point: `src/site.css` → PostCSS processes imports from `src/_styles/` → output: `dist/styles/site.css`

### Deployment
Push to `main` triggers GitHub Actions workflow that builds and deploys to GitHub Pages.

### Mastodon syndication
After a successful deploy, the `post-mastodon` job in `jekyll-gh-pages.yml` runs
`scripts/post-to-mastodon.js` (CommonJS, zero dependencies — Node builtins and global `fetch` only).

- Posts only recipes **added** since the `mastodon-syndicated` git tag (`git diff --diff-filter=A`,
  two-dot so merge commits are included). The tag is the durable high-water mark and advances only
  to the last recipe that actually posted, which is what makes a dropped or failed run self-heal.
  `BEFORE_SHA` is a fallback; with no base at all the script exits 0 rather than guessing.
- Config is env-only: `MASTODON` (token, repo secret) and `MASTODON_SERVER` (repo variable). The job
  is skipped when the secret is absent.
- The recipe URL is `{canonicalDomain}/recipes/{fileSlug}/` where **`fileSlug` strips the
  `YYYY-MM-DD-` prefix** — the live URL carries no date. `SITE` in the script duplicates
  `meta.canonicalDomain` deliberately; `meta.domain` flips to localhost under `serve`.
- Character budget assumes Mastodon's rule that any URL counts as 23 characters. Count code points
  (`Array.from(s).length`), not `.length`. Hashtags strip non-alphanumerics because Mastodon
  terminates a tag at `-`.
- Guardrails against mass-posting the 226-post back catalogue: `--max` (5) and `--max-age-days` (7).
  Verify any change with `--dry-run` across every post before touching the live path.
