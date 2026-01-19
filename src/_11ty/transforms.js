// Note: html-minifier@4.0.0 has a known REDoS vulnerability with no fix available
// Using html-minifier-next instead (actively maintained with ReDoS protection)
const { minify } = require("html-minifier-next");

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
	htmlmin,
};
