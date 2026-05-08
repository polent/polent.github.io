---
layout: "layouts/page"
eleventyNavigation:
  key: chefs
  title: Our Chefs
  order: 2
title: "Our Chefs"
description: "Meet our four AI chefs — Emily, Hiroshi, Isabella and Nia — and browse their vegan recipes by cuisine."
permalink: "/our-chefs/index.html"
---

Each of our chefs has their own perspective on plant-based cooking. Pick one to browse their recipes.

<ul class="chef-grid" role="list">
{% for chef in chefs %}
  <li class="chef-grid__item">
    <a class="chef-card" href="/chefs/{{ chef.slug }}/">
      {% figure %}
        {% picture chef.portrait, chef.portraitAlt, chef.portraitAlt, "lazy", "(min-width: 60rem) 280px, (min-width: 30rem) 50vw, 100vw" %}
      {% endfigure %}
      <h2 class="chef-card__name">{{ chef.name }}</h2>
      <p class="chef-card__tagline">{{ chef.tagline }}</p>
      <p class="chef-card__region"><span class="visually-hidden">Region: </span>{{ chef.region }} · {{ chef.cuisine }}</p>
    </a>
  </li>
{% endfor %}
</ul>
