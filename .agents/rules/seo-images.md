---
trigger: model_decision
description: "SEO best practices, image indexing guidelines, and structured data standards for recipe.polente.de"
---

# Technical SEO & Image Optimization Rules

When creating templates, updating media pipelines, or modifying metadata, adhere to these technical standards:

## 1. Image Indexing & Googlebot Guidelines
- **Responsive Generation:** All images must be processed through the `picture` shortcode in `src/_11ty/shortcodes.js`.
- **Descriptive Slugs:** Image filenames must retain the kebab-case dish name (`filenameFormat` in `shortcodes.js`).
- **High-Resolution Fallbacks:** The fallback `<img>` `src` attribute must point to the highest available JPEG resolution (1280px / 1600px).
- **Robots Directives:** Default robots meta must include `max-image-preview:large` to ensure eligibility for Google Discover and visual rich results.
- **Image Sitemaps:** `sitemap.xml` must declare images using `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` and `<image:image><image:loc>...</image:loc></image:image>`.

## 2. Structured Data (Schema.org)
- **Recipe Schema:** Every recipe page must emit valid `Recipe` JSON-LD including:
  - `name`, `description`, `url`, `datePublished`
  - `image`: Full high-resolution absolute URL (`meta.canonicalDomain + ...`)
  - `recipeIngredient`: Array of strings
  - `recipeInstructions`: Array of `HowToStep` with step URLs pointing to `#stepN`
  - `recipeCuisine`, `recipeYield`, `nutrition` (`NutritionInformation`)
  - `author`: `Person` with `@id` and `url` referencing `/chefs/<slug>/`
- **Breadcrumbs:** `BreadcrumbList` on recipe and chef pages using `meta.canonicalDomain`.
- **WebSite SearchAction:** Sitelinks searchbox schema pointing to `/search/?q={search_term_string}`.

## 3. Social & Open Graph
- Use `meta.canonicalDomain` for `og:url`, `og:image`, `canonical`, and `twitter:image`.
- Recipe pages must declare `og:type` as `"article"`.
- Always provide both `og:image` and `twitter:image` with corresponding alt text.

## 4. Crawl Budget & Indexing Hygiene
- Tags with fewer than 2 recipes are marked `noindex, follow` and excluded from `sitemap.xml`.
- Chef tag listing pages (`/tag/hiroshi/`) are marked `noindex, follow` to prevent duplicating the canonical chef page (`/chefs/hiroshi/`).
