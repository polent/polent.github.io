// Agentic Resource Discovery catalog (https://github.com/Agent-Card/ai-catalog).
// Points agents at the machine-readable entry points this static site already has.
// GitHub Pages serves it as application/json; the spec only says SHOULD for
// application/ai-catalog+json, and Pages offers no way to set headers.

module.exports = class {
	data() {
		return {
			permalink: "/.well-known/ai-catalog.json",
			eleventyExcludeFromCollections: true,
		};
	}

	render({ meta }) {
		const site = meta.canonicalDomain;
		const host = new URL(site).host;
		const publisher = { identifier: host, identityType: "dns", displayName: meta.projectName };
		const tags = ["vegan", "recipes", "cooking", "plant-based"];

		const entries = [
			{
				identifier: `urn:air:${host}:knowledge:llms-txt`,
				displayName: "Recipe index for LLMs",
				type: "text/markdown",
				url: `${site}/llms.txt`,
				description:
					"Every recipe with title, URL and summary, plus the four AI chefs. Recipe pages carry schema.org Recipe JSON-LD.",
				tags,
			},
			{
				identifier: `urn:air:${host}:feed:atom`,
				displayName: "Recipe feed",
				type: "application/atom+xml",
				url: `${site}/feed.xml`,
				description: "Atom feed of the newest vegan recipes, published daily.",
				tags,
			},
			{
				identifier: `urn:air:${host}:index:sitemap`,
				displayName: "Sitemap",
				type: "application/xml",
				url: `${site}/sitemap.xml`,
				description: "XML sitemap of every page on the site.",
				tags,
			},
		].map(entry => ({ ...entry, publisher }));

		return JSON.stringify({ specVersion: "1.0", entries }, null, "\t");
	}
};
