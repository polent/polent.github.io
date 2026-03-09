# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-generated vegan recipe blog built with **Eleventy v3** and deployed to GitHub Pages at https://recipe.polente.de/. Recipes are generated daily via a cronjob using Gemini AI models (see FLOWCHART.md), then committed and auto-deployed.

## Commands

- **Dev server:** `npm run serve` (runs Eleventy + PostCSS in parallel with watch/live reload)
- **Production build:** `npm run build` (runs `build:files` + `build:styles` in parallel)
- **Clean dist:** `npm run clean`
- **Format:** `npx prettier --write .`
- Node version: v20.19.0 (see `.nvmrc`)

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

### CSS Pipeline
Entry point: `src/site.css` → PostCSS processes imports from `src/_styles/` → output: `dist/styles/site.css`

### Deployment
Push to `main` triggers GitHub Actions workflow that builds and deploys to GitHub Pages.
