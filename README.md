# Polente Recipes

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9967/badge)](https://www.bestpractices.dev/projects/9967)

A vegan recipe blog whose recipes are written and illustrated by AI, once a day, without a
human in the loop. Built with [Eleventy](https://www.11ty.dev/) v3 and served as static
files from GitHub Pages.

**Live site: [recipe.polente.de](https://recipe.polente.de/)**

Every recipe on the site is generated — text, image and all — so treat the nutrition
figures and allergen information as decoration rather than fact. The
[imprint](https://recipe.polente.de/imprint/) says the same thing at more length.

## How a recipe gets here

A cronjob runs once a day, prompts Gemini for a recipe and a matching image, writes a
markdown file plus a PNG into `src/`, and pushes. The push triggers the GitHub Actions
workflow, which builds the site and deploys it. See [FLOWCHART.md](FLOWCHART.md) for the
diagram.

There are currently 226 recipes, attributed to four fictional chefs (Emily, Hiroshi,
Isabella and Nia) defined in [`src/_11ty/data/chefs.js`](src/_11ty/data/chefs.js). The
chef is the last, capitalised entry in a post's `tags`.

## Running it locally

Requires Node v22.11.0 (see [`.nvmrc`](.nvmrc)) — `@11ty/eleventy-img` v7 needs Node 22 or
newer.

```bash
npm install
npm run serve     # Eleventy + PostCSS in parallel, with live reload, on localhost:8080
```

| Script | What it does |
| --- | --- |
| `npm run serve` | Dev server with watch and live reload |
| `npm run build` | Full production build into `dist/` |
| `npm run clean` | Delete `dist/` |
| `npx prettier --write .` | Format |

`npm run build` runs four steps: Eleventy and PostCSS in parallel, then
[Critters](https://github.com/GoogleChromeLabs/critters) to inline critical CSS, then
[Pagefind](https://pagefind.app/) to build the search index. The first build is slow
because `@11ty/eleventy-img` generates AVIF, WebP and JPEG at five widths for every recipe
photo; later builds reuse what is already in `dist/img/`.

## Layout of the repo

```text
src/
├── _11ty/          Eleventy extensions: collections, filters, shortcodes,
│                   transforms, global data (meta.js, chefs.js), markdown-it config
├── _includes/      Nunjucks layouts and partials
├── _styles/        PostCSS sources — config, variables, utilities, base,
│                   layout, components
├── content/        Pages, and posts/ with one markdown file per recipe
├── media/          Recipe images (source resolution)
├── static/         Passthrough: fonts, favicons, JS, robots.txt
└── site.css        PostCSS entry point
```

[CLAUDE.md](CLAUDE.md) documents the architecture in more depth — the filters, the
transforms, the consent model and the microformats markup.

## What the site does beyond rendering markdown

- **Structured data.** [`extractRecipeData`](src/_11ty/filters.js) parses the *rendered*
  HTML of each post to pull out ingredients, numbered steps, times, yield and nutrition,
  and emits schema.org `Recipe` JSON-LD from it. `Person`, `BreadcrumbList` and `WebSite`
  JSON-LD are emitted too.
- **Cook mode.** A full-screen step-by-step view with tickable ingredients, tap-to-start
  timers parsed out of the instruction text, and a screen wake lock
  ([`src/static/js/cook-mode.js`](src/static/js/cook-mode.js)).
- **Print modes.** Print the whole recipe, or just a shopping list of the ingredients you
  have not already ticked off.
- **Client-side search** over every recipe, with chef and cuisine filters, via Pagefind.
- **Webmentions**, opt-in — see below.
- **Microformats2.** Posts are `h-entry` with a `p-author h-card`; listings are `h-feed`;
  chef pages are `h-card`. This is what lets other IndieWeb sites render a link to a recipe
  as a real post rather than a bare URL.

## Privacy

The site sets **no cookies**, loads **no third-party resources** and runs **no analytics**
by default. There is exactly one exception, and it is opt-in:

Recipes can be replied to from elsewhere on the web via
[Webmention](https://indieweb.org/Webmention), and those responses are collected by
[webmention.io](https://webmention.io/). Fetching them means the reader's browser contacts
that service, so a banner asks first. Nothing is requested until they accept, and declining
removes the responses section from the page entirely. The answer is stored in a single
first-party cookie, `wm-consent`.

The renderer in [`src/static/js/webmentions.js`](src/static/js/webmentions.js) is
deliberately not webmention.io's own embed script, because it applies rules that script
does not:

- Likes, reposts, bookmarks and RSVPs are shown **only as a total count** — somebody who
  hearts a post on Mastodon did not agree to have their name republished here.
- Replies show a name, a date and plain text. **No profile picture is ever loaded** from
  any host; the coloured initial is drawn in CSS.
- Reply content is inserted as text, never as markup, so a reply cannot make the reader's
  browser contact a third site.

The reasoning follows Alex Hyett's
[Opting for privacy in webmentions](https://www.alexhyett.com/opting-for-privacy-in-webmentions/).
[`src/content/privacy.md`](src/content/privacy.md) is the reader-facing version and should
be kept in sync with the code.

## Deployment

Pushing to `main` runs [`.github/workflows/jekyll-gh-pages.yml`](.github/workflows/jekyll-gh-pages.yml),
which builds and publishes `dist/` to GitHub Pages. The custom domain comes from the
[`CNAME`](CNAME) file. Because Pages serves no custom response headers, anything
header-shaped has to be done in markup.

## Contributing

Issues and pull requests are welcome, but note that `src/content/posts/` and `src/media/`
are written by the daily job — changes there will be buried under new commits. Everything
else (templates, styles, build config, client-side JS) is hand-written and fair game.
