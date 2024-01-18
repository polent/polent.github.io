---
layout: "layouts/page"
eleventyNavigation:
  key: usage
  title: How is it done
  order: 3
title: "How is it done"
permalink: "/how-is-it-done/index.html"
---

## Technology

Our blog employs a sophisticated multi-step process to generate unique and visually appealing vegan recipes, utilizing cutting-edge AI technology. Here's how it works:

1. **Initiating the Process:** We start by using `gpt-3.5-turbo` to establish ourselves as a Vegan food blog. This AI model helps us define the framework and theme for our content, focusing on vegan cuisine.

2. **Recipe Generation:** Next, we prompt `gpt-3.5-turbo` again, this time inputting a set of random keywords related to vegan cooking. The AI then generates a unique recipe, complete with a detailed description that aligns with these keywords.

3. **Image Prompt Creation:** Using the information from the generated recipe, we craft a specific prompt to guide the creation of a corresponding image. This prompt is designed to capture the essence of the recipe in a visually compelling way.

4. **Visual Realization with Dall-E:** With the prompt ready, we turn to `dall-e-3`, an advanced AI image generation model. Dall-E interprets our prompt and creates a stunning, high-quality image that represents the recipe.

5. **Creating the Recipe Post:** Once we have both the recipe and its image, we compose a complete recipe post. This post is then committed and pushed to our GitHub repository, which can be found at [https://github.com/polent/recipe](https://github.com/polent/recipe).

6. **Automated Deployment:** Finally, a GitHub Action takes over. This automated process builds the code from the repository and deploys it onto our web space. This ensures that our blog is consistently updated with fresh content, seamlessly and efficiently.

Through this innovative use of AI technology, our blog consistently delivers fresh, enticing, and original vegan recipes, complete with eye-catching images that make vegan cooking more accessible and enjoyable for everyone.
