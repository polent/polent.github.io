# GEMINI.md

This document provides system instructions, architectural context, and coding guidelines for Antigravity (AGY) when operating in this repository.

## Project Overview

AI-generated vegan recipe blog built with **Eleventy (11ty) v3** and deployed to GitHub Pages at **https://recipe.polente.de/**. Recipes are generated daily via an automated cronjob utilizing Gemini AI models (see `FLOWCHART.md`), then committed and auto-deployed.

## Core Commands & Tooling

- **Development server:** `npm run serve` (runs Eleventy + PostCSS concurrently with live reload)
- **Production build:** `npm run build` (runs `build:files` + `build:styles`, followed by `build:critical` and `build:pagefind`)
- **Incremental file build:** `npm run build:files`
- **Clean output:** `npm run clean`
- **Code formatting:** `npx prettier --write .`
- **Node runtime:** Node 24 (see `.nvmrc`). **Hard requirement: Node >= 22** (`@11ty/eleventy-img` v7 requires Node 22+).

## Repository Architecture

```text
├── .agents/                 # AGY rules and workspace skills
├── eleventy.config.js       # 11ty root configuration (CommonJS)
├── scripts/
│   ├── critical-css.js      # Inlines critical CSS with Critters
│   ├── post-to-mastodon.js  # Mastodon syndication runner
│   └── prune-images.js      # Deletes unreferenced assets in dist/img/
├── src/
│   ├── _11ty/               # Collections, filters, shortcodes, transforms, data
│   │   ├── data/            # Global data (meta.js, chefs.js, helpers.js)
│   │   ├── filters.js       # Recipe schema extraction, date formatting, sitemapUrls
│   │   ├── shortcodes.js    # Responsive picture & figure shortcodes (AVIF/WebP/JPEG)
│   │   └── transforms.js   # addStepIds, htmlmin
│   ├── _includes/
│   │   ├── layouts/         # Page templates (base, post, chef, home, list, page)
│   │   └── partials/        # Components (base-head, site-header, site-footer, etc.)
│   ├── _styles/             # PostCSS stylesheet sources
│   ├── content/
│   │   ├── posts/           # Markdown recipes (YYYY-MM-DD-slug-NNNN.md)
│   │   └── *.md             # Standalone pages (about, chefs, privacy, search)
│   ├── media/               # Source recipe images (PNG/JPG)
│   └── static/              # Passthrough assets (favicons, fonts, robots.txt, JS)
```

## Critical Architectural Guidelines

### 1. Canonical Domain vs. Environment Domain
- `meta.canonicalDomain` (`https://recipe.polente.de`) is **always** the live origin.
- `meta.domain` dynamically switches to `http://localhost:8080` during `npm run serve`.
- **Rule:** For `<link rel="canonical">`, OpenGraph URLs (`og:url`, `og:image`), Twitter Cards, Schema.org IDs/URLs, and Sitemaps, **always use `meta.canonicalDomain`** so local/preview builds never output localhost links.

### 2. SEO & Image Guidelines
- **Responsive Images:** Generated via `@11ty/eleventy-img` inside `src/_11ty/shortcodes.js`.
- **Descriptive Filenames:** Output filenames must use `filenameFormat` to preserve semantic recipe slugs (e.g., `2026-10-17-tuscan-bento-1280.jpeg`) rather than opaque hashes.
- **High-Res Fallback:** The fallback `<img>` `src` must point to the highest-resolution JPEG asset so that standard search indexers and social scrapers receive high-resolution imagery.
- **Robots Directive:** Must declare `max-image-preview:large` to ensure eligibility for Google Discover and visual rich snippets.
- **Sitemap with Image Extensions:** `src/sitemap.xml.njk` includes the `xmlns:image` namespace and declares `<image:image><image:loc>...</image:loc></image:image>` for recipe posts.

### 3. Recipe Markdown Structure (`src/content/posts/`)
Every recipe post in `src/content/posts/` inherits shared settings from `posts.json` (`layout: layouts/post`, `isRecipe: true`).
Required frontmatter schema:
```yaml
---
title: "Descriptive Recipe Title"
description: "Compelling summary between 120 and 160 characters."
tags:
  - "vegan"
  - "keyword"
  - "Emily" # Chef name must be the final tag with uppercase first letter
figureRecipe:
  caption: "Image caption matching dish"
  imageSrc: "./src/media/YYYY-MM-DD-recipe-slug-NNNN.png"
  imageTitle: "Image Title"
  imageAlt: "Detailed, accessible description of the dish."
  loading: "eager"
---
```
Required Markdown body sections:
1. `{% figure %}{% picture %}{% endfigure %}` shortcode block at top.
2. `## Introduction`
3. `## Ingredients` (bulleted list)
4. `## Instructions` (bulleted list; transformed to `<ol>` with deep-link IDs `#step1`, `#step2`)
5. Chef sign-off: `*ChefName*`
6. Nutrition table: `<table>...Nutritionfacts, Preparation Time, Yield...</table>`

### 4. Git Lastmod in Sitemap
- The sitemap derives `<lastmod>` from `git log` commits to ensure reproducible builds.
- In CI workflows, `actions/checkout` must use `fetch-depth: 0` (full history) or `<lastmod>` falls back to build timestamps.

### 5. Mastodon Syndication (POSSE)
- `scripts/post-to-mastodon.js` runs after deployment to syndicate new recipes to Mastodon.
- Uses the `mastodon-syndicated` git tag as its persistent high-water mark.
- Uploads images directly from `src/media/` using the Mastodon media API.

### 6. Privacy & Third-Party Assets
- **Webmentions:** Gated behind explicit visitor consent (`wm-consent` cookie) via `src/_includes/partials/consent-banner.njk`. Avatar images are strictly restricted to `avatars.webmention.io`.
- **EchoThread Comments:** Click-to-load widget; no third-party cookies or scripts run until user explicitly activates comments.
- Keep `src/content/privacy.md` aligned with any changes to external integrations.
