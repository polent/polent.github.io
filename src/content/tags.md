---
layout: "layouts/tag-results"
title: "Tags"
pagination:
  data: "collections"
  size: 1
  alias: "tag"
  filter:
    - "all"
    - "posts"
    - "latest"
    - "featured"
    - "feed"
permalink: "/tag/{{ tag | slug }}/"
eleventyComputed:
  title: "{{ tag }} recipes"
  description: "Every vegan {{ tag }} recipe on Recipes by our chefs — AI-generated plant-based dishes with full ingredient lists, step-by-step instructions and nutrition."
---
