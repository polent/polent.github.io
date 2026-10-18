---
name: validate-recipes
description: >-
  Validates recipe posts for SEO compliance, schema integrity, required frontmatter,
  matching images in src/media/, and nutritional markup. Use when creating or testing
  new recipes or auditing the recipe collection.
---

# Validate Recipes Skill

Use this procedure to validate recipe files against required schemas, asset requirements, and SEO constraints.

## Verification Checklist

1. **Frontmatter Integrity:**
   - Confirm `title` and `description` are non-empty.
   - Confirm `tags` includes `"vegan"`, appropriate culinary tags, and a valid capitalized chef name as the last item (`"Emily"`, `"Hiroshi"`, `"Isabella"`, or `"Nia"`).
   - Check `figureRecipe.imageSrc` points to an existing file in `src/media/`.
   - Ensure `figureRecipe.imageAlt` contains descriptive, accessible text.

2. **Content Structure:**
   - Verify `{% figure figureRecipe.caption %}` wraps `{% picture %}`.
   - Confirm `## Ingredients` has bulleted items.
   - Confirm `## Instructions` has step-by-step instructions.
   - Check nutrition table at the end of the post with valid `Nutritionfacts` and `Preparation Time`.

3. **Dry-Run Validation Script:**
   Run the inline recipe validator:
   ```bash
   node -e '
   const fs = require("fs");
   const path = require("path");
   const dir = "src/content/posts";
   const chefs = new Set(["Emily", "Hiroshi", "Isabella", "Nia"]);
   let errors = 0;
   for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".md"))) {
     const raw = fs.readFileSync(path.join(dir, f), "utf8");
     const imgMatch = raw.match(/imageSrc:\s*["\x27]?([^"\x27\n]+)/);
     if (imgMatch) {
       const imgPath = imgMatch[1].trim();
       if (!fs.existsSync(imgPath)) {
         console.error(`[MISSING IMAGE] ${f} -> ${imgPath}`);
         errors++;
       }
     }
   }
   console.log(`Validation finished. Errors: ${errors}`);
   '
   ```
