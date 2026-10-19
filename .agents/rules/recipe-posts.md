---
trigger: model_decision
description: "Guidelines and schema requirements for authoring, editing, or validating recipe posts in src/content/posts/"
---

# Recipe Post Authoring Rules

When adding, editing, or validating recipe posts in `src/content/posts/`, adhere strictly to these conventions:

## 1. Filename Convention
- Filename format: `YYYY-MM-DD-kebab-slug-NNNN.md` (e.g. `2026-10-18-charred-miso-tempeh-bowl-4921.md`).
- Date prefix determines publication ordering.
- The 4-digit numeric suffix ensures uniqueness.

## 2. Frontmatter Requirements
```yaml
---
title: "Recipe Title"
description: "Compelling recipe description under 160 characters for search and social previews."
tags:
  - "vegan"
  - "tag-slug"
  - "Emily" # Or Hiroshi, Isabella, Nia. Must be capitalized.
figureRecipe:
  caption: "Recipe Title"
  imageSrc: "./src/media/YYYY-MM-DD-kebab-slug-NNNN.png"
  imageTitle: "Recipe Title"
  imageAlt: "Detailed, sensory visual description of the dish."
  loading: "eager"
---
```

## 3. Chef Name and Cuisines
The last tag determines the chef persona and cuisine:
- **Hiroshi**: Asian cuisine
- **Emily**: North American cuisine
- **Isabella**: Italian cuisine
- **Nia**: African cuisine

## 4. Required Markdown Structure
1. **Hero Media:**
   ```jinja2
   {% figure figureRecipe.caption %}
   {% picture figureRecipe.imageSrc, figureRecipe.imageTitle, figureRecipe.imageAlt, figureRecipe.loading %}
   {% endfigure %}
   ```
2. **`## Introduction`**: 1-2 paragraphs of storytelling and culinary context.
3. **`## Ingredients`**: Bulleted list of ingredients.
4. **`## Instructions`**: Bulleted list of numbered steps (the `addStepIds` transform and `extractRecipeData` filter automatically convert this into semantic `<ol>` with `#step1`, `#step2` IDs for Schema.org `HowToStep`).
5. **Closing reflection & chef signature:** `*ChefName*`
6. **Nutrition & Metadata Table:**
   ```html
   <table>
     <caption class='sr-only'>Additional Information</caption>
     <tr><th scope='row'>Nutritionfacts</th><td>520 kcal, 18g protein, 65g carbohydrates, 16g fat, 12g fiber, 480mg sodium</td></tr>
     <tr><th scope='row'>Preparation Time</th><td>45 minutes</td></tr>
     <tr><th scope='row'>Allergy Information</th><td>Soy, Sesame</td></tr>
     <tr><th scope='row'>Yield</th><td>2 servings</td></tr>
   </table>
   ```

## 5. Verification Checklist
- Source image exists in `src/media/` matching `figureRecipe.imageSrc`.
- Nutrition table contains valid calories, protein, carbohydrates, fat, fiber, and sodium.
- Preparation time is formatted like `"X minutes"` or `"X hours Y minutes"`.
