---
layout: "layouts/page"
eleventyNavigation:
  key: search
  title: Search
  order: 4
title: "Search our Vegan Recipes"
description: "Search hundreds of AI-generated vegan recipes by ingredient, technique or chef."
permalink: "/search/index.html"
---

<link rel="stylesheet" href="/pagefind/pagefind-component-ui.css">

<p class="recipe-search-intro">Search by ingredient, technique, chef, or cuisine. Filter by chef or cuisine in the sidebar — results update live as you type.</p>

<div class="recipe-search">
  <pagefind-input class="recipe-search__input" placeholder="Search recipes…"></pagefind-input>
  <pagefind-summary class="recipe-search__summary" default-message="Start typing to search."></pagefind-summary>
  <pagefind-filter-pane class="recipe-search__filters"></pagefind-filter-pane>
  <pagefind-results class="recipe-search__results" show-images></pagefind-results>
</div>

<noscript>
  <p>Live search needs JavaScript. You can still <a href="https://www.google.com/search?q=site%3Arecipe.polente.de">browse via Google</a> or open the <a href="/recipes/">recipes index</a>.</p>
</noscript>

<script src="/pagefind/pagefind-component-ui.js" type="module"></script>
<script type="module">
  // Module scripts run in document order, so the components are defined by now.
  const instance = window.PagefindComponents?.getInstanceManager().getInstance("default");
  if (instance) {
    instance.setTranslations({
      zero_results: "No recipes match \"[SEARCH_TERM]\". Try a different ingredient or chef name.",
      clear_search: "Clear search",
      load_more: "Load more recipes",
      search_label: "Search recipes",
      filters_label: "Filter by",
      results_label: "Recipes"
    });

    // Pre-populate the search from a ?q= URL parameter so the SearchAction
    // sitelinks-searchbox entry point works (and so a /search/?q=tofu link from
    // anywhere on the web lands on actual results). The input syncs its value.
    const initialQuery = new URLSearchParams(window.location.search).get("q");
    if (initialQuery) {
      instance.triggerSearch(initialQuery);
    }
  }
</script>
