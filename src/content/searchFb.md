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

<link rel="stylesheet" href="/pagefind/pagefind-ui.css">

<p class="recipe-search-intro">Search by ingredient, technique, chef, or cuisine. Filter by chef or cuisine in the sidebar — results update live as you type.</p>

<div id="pagefind-search" class="recipe-search"></div>

<noscript>
  <p>Live search needs JavaScript. You can still <a href="https://www.google.com/search?q=site%3Arecipe.polente.de">browse via Google</a> or open the <a href="/recipes/">recipes index</a>.</p>
</noscript>

<script src="/pagefind/pagefind-ui.js" defer></script>
<script>
  window.addEventListener("DOMContentLoaded", () => {
    if (typeof PagefindUI === "undefined") return;
    const ui = new PagefindUI({
      element: "#pagefind-search",
      showImages: true,
      showSubResults: true,
      showEmptyFilters: false,
      pageSize: 10,
      resetStyles: false,
      translations: {
        placeholder: "Search recipes…",
        zero_results: "No recipes match \"[SEARCH_TERM]\". Try a different ingredient or chef name.",
        clear_search: "Clear search",
        load_more: "Load more recipes",
        search_label: "Search recipes",
        filters_label: "Filter by",
        zero_results_default: "Start typing to search."
      }
    });

    // Pre-populate the search input from a ?q= URL parameter so the SearchAction
    // sitelinks-searchbox entry point works (and so a /search/?q=tofu link from
    // anywhere on the web lands on actual results).
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery) {
      ui.triggerSearch(initialQuery);
    }
  });
</script>
