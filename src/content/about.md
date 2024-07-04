---
layout: "layouts/page"
eleventyNavigation:
  key: about
  title: How is it done
  order: 3
title: "How is it done"
description: "Discover our AI-driven process for creating unique vegan recipes. We use gpt- 4o for content framework and dall-e-3 for stunning images, seamlessly updating our blog with fresh, enticing vegan dishes."
permalink: "/how-is-it-done/index.html"
figureAbout: 
  caption: "Vegan Food Blog Technology Workflow"
  className: "about-figure"
  imageSrc: "./src/media/about/477da717-825a-40f2-a531-39bdb6615b68.png"
  imageTitle: "Vegan Food Blog Technology Workflow"
  imageAlt: "flow chart illustrating the multi-step process used by your vegan food blog, detailing each stage from initiating the process with gpt- 4o to the automated deployment of content. This visual representation helps in understanding the sequence and interactions of the various steps involved in your sophisticated AI-driven recipe generation and posting."
  loading: "lazy"
---

## Technology

Our blog employs a sophisticated multi-step process to generate unique and visually appealing vegan recipes, utilizing cutting-edge AI technology. Here's how it works:

1. **Initiating the Process:** We start by using `gpt- 4o` to establish ourselves as a Vegan food blog. This AI model helps us define the framework and theme for our content, focusing on vegan cuisine.
2. **Recipe Generation:** Next, we prompt `gpt- 4o` again, this time inputting a set of random keywords related to vegan cooking. The AI then generates a unique recipe, complete with a detailed description that aligns with these keywords.
3. **Image Prompt Creation:** Using the information from the generated recipe, we craft a specific prompt to guide the creation of a corresponding image. This prompt is designed to capture the essence of the recipe in a visually compelling way.
4. **Visual Realization with Dall-E:** With the prompt ready, we turn to `dall-e-3`, an advanced AI image generation model. Dall-E interprets our prompt and creates a stunning, high-quality image that represents the recipe.
5. **Creating the Recipe Post:** Once we have both the recipe and its image, we compose a complete recipe post. This post is then committed and pushed to our GitHub repository, which can be found at [https://github.com/polent/recipe](https://github.com/polent/recipe).
6. **Automated Deployment:** Finally, a GitHub Action takes over. This automated process builds the code from the repository and deploys it onto our web space. This ensures that our blog is consistently updated with fresh content, seamlessly and efficiently.
7. **Start over:** The steps start again, 1-2 times a day initiated by a conjob.

{% figure figureAbout.caption, figureAbout.className %}
{% picture figureAbout.imageSrc, figureAbout.imageTitle, figureAbout.imageAlt, figureAbout.loading %}
{% endfigure %}

Through this innovative use of AI technology, our blog consistently delivers fresh, enticing, and original vegan recipes, complete with eye-catching images that make vegan cooking more accessible and enjoyable for everyone.
