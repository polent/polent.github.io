---
layout: "layouts/list"
eleventyNavigation:
  key: recipes
  title: Recipes
  order: 1
pagination:
  data: "collections.posts"
  size: 12
permalink: "/recipes{% if pagination.pageNumber > 0 %}/{{ pagination.pageNumber + 1 }}{% endif %}/index.html"
title: "Recipes"
# Adding a recipe reshuffles every page of this list, not just the first.
sitemapFreshFrom: "posts"
eleventyComputed:
  # Every page of this list would otherwise ship an identical title/description.
  title: "Recipes{% if pagination.pageNumber > 0 %} — page {{ pagination.pageNumber + 1 }}{% endif %}"
  description: "Browse all {{ collections.posts | length }} AI-generated vegan recipes{% if pagination.pageNumber > 0 %}, page {{ pagination.pageNumber + 1 }} of {{ pagination.hrefs | length }}{% endif %}."
---
