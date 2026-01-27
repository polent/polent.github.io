// Note: html-minifier@4.0.0 has a known REDoS vulnerability with no fix available
// Using html-minifier-next instead (actively maintained with ReDoS protection)
const { minify } = require("html-minifier-next");

const addStepIds = function (content, outputPath) {
	// Only add step IDs for recipe pages
	if (outputPath?.endsWith(".html") && content.includes('recipeCuisine')) {
		try {
			let stepCounter = 1;
			// Find the Instructions section and add IDs to list items
			const instructionsRegex = /(<h2[^>]*>Instructions<\/h2>[\s\S]*?<ol>)([\s\S]*?)(<\/ol>)/;
			const match = content.match(instructionsRegex);
			
			if (match) {
				const [fullMatch, beforeOl, olContent, afterOl] = match;
				let modifiedOlContent = olContent;
				const liRegex = /<li([^>]*)>/gi;
				
				modifiedOlContent = modifiedOlContent.replace(liRegex, (liMatch, attributes) => {
					if (attributes.includes('id=')) {
						// Replace existing id
						return liMatch.replace(/id=['"][^'"]*['"]/i, `id="step${stepCounter++}"`);
					} else {
						// Add id to existing attributes
						stepCounter++;
						return `<li${attributes} id="step${stepCounter - 1}">`;
					}
				});
				
				content = content.replace(fullMatch, beforeOl + modifiedOlContent + afterOl);
			}
		} catch (err) {
			console.error("Error adding step IDs:", err);
			// Continue with unmodified content on error
		}
	}
	return content;
};

const htmlmin = async function (content, outputPath) {
	// Only minify HTML files during build (not during development serve)
	if (process.env.ELEVENTY_RUN_MODE !== "serve" && outputPath?.endsWith(".html")) {
		try {
			return await minify(content, {
				useShortDoctype: true,
				removeComments: true,
				collapseWhitespace: true,
				collapseInlineTagWhitespace: true,
				removeAttributeQuotes: true,
				removeRedundantAttributes: true,
				removeEmptyAttributes: true,
				removeOptionalTags: true,
				removeScriptTypeAttributes: true,
				removeStyleLinkTypeAttributes: true,
				minifyJS: true,
				minifyCSS: true,
				// Template support for Nunjucks
				ignoreCustomFragments: [
					/\{%[\s\S]{0,500}?%\}/,  // Nunjucks tags
					/\{\{[\s\S]{0,500}?\}\}/ // Nunjucks expressions
				],
				// ReDoS protection (prevents regex attacks)
				customFragmentQuantifierLimit: 200,
			});
		} catch (err) {
			console.error("HTML minification error for", outputPath, ":", err);
			return content; // Return unminified on error
		}
	}
	return content;
};

module.exports = {
	addStepIds,
	htmlmin,
};
