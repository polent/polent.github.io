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
---
