---
layout: "layouts/tag-results"
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
  # `| safe` stops the tag being escaped here and again when base-head prints it.
  title: "{{ tag | replace(\"-\", \" \") | safe }} recipes"
  description: "Browse every {{ tag | replace(\"-\", \" \") | safe }} recipe on Recipes by our chefs: AI-generated plant-based dishes with full ingredient lists, step-by-step instructions and nutrition."
---
