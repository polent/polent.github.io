---
layout: "layouts/page"
eleventyNavigation:
  key: about
  title: How is it done
  order: 3
title: "How is it done"
description: "Discover our AI-driven process for creating unique vegan recipes. We use gemini-3-flash-preview for the recipe and gemini-3.1-flash-image-preview for the image, seamlessly updating our blog with fresh, enticing vegan dishes."
permalink: "/how-is-it-done/index.html"
figureAbout: 
  caption: "Vegan Food Blog Technology Workflow"
  className: "about-figure"
  imageSrc: "./src/media/about/Gemini_Generated_Image_7zyx1r7zyx1r7zyx.png"
  imageTitle: "Vegan Food Blog Technology Workflow"
  imageAlt: "flow chart illustrating the multi-step process used by your vegan food blog, detailing each stage from initiating the process with gemini-3-flash-preview to the automated deployment of content. This visual representation helps in understanding the sequence and interactions of the various steps involved in your sophisticated AI-driven recipe generation and posting."
  loading: "lazy"
---

## Technology

This blog employs a sophisticated multi-step process to generate unique and visually appealing vegan recipes, utilizing cutting-edge AI technology. Here's how it works:

1. **Picking a Chef and a Theme:** We randomly choose one of four vegan chef personas — Emily (Northern California), Hiroshi (Kyoto shojin ryori), Isabella (Tuscany), or Nia (Swahili coast) — and pair them with a random style adjective and a random kind of dish drawn from curated lists.
2. **Recipe Generation:** We send a single prompt to `gemini-3-flash-preview` that combines the chef persona, the style and kind, and a strict JSON template. The model returns the title, intro, outro, ingredients, instructions, tags, SEO description, nutrition facts, allergies, preparation time, yield, an image prompt, and an image alt text — all in one structured response.
3. **Validation and Sanitization:** The JSON is parsed and checked for required keys. The slug is normalized to lowercase ASCII letters, digits, and hyphens before it touches the filesystem or git.
4. **Visual Realization with Nano Banana:** The image prompt produced in step 2 is sent to `gemini-3.1-flash-image-preview` (Nano Banana) at 3:2 aspect ratio and 2K size. The call is retried up to three times in case the response is missing image data.
5. **Assembling the Post:** The base64 image is decoded and saved into `src/media/`. Front matter (title, description, tags, figure metadata including the alt text) and the body (intro, ingredients, instructions, outro, chef signature, and an additional-info table) are written to a markdown file in `src/content/posts/` using {% raw %}`{% figure %}`{% endraw %} and {% raw %}`{% picture %}`{% endraw %} shortcodes for responsive images.
6. **Commit and Push:** The image and markdown file are staged, committed with a slug-based message, and pushed to [https://github.com/polent/recipe](https://github.com/polent/recipe).
7. **Automated Deployment:** A GitHub Action builds the Eleventy site and deploys it to GitHub Pages.
8. **Start over:** A cronjob triggers the script once per day, so the cycle repeats.

{% figure figureAbout.caption, figureAbout.className %}
{% picture figureAbout.imageSrc, figureAbout.imageTitle, figureAbout.imageAlt, figureAbout.loading %}
{% endfigure %}

Through this innovative use of AI technology, our blog consistently delivers fresh, enticing, and original vegan recipes, complete with eye-catching images that make vegan cooking more accessible and enjoyable for everyone.
