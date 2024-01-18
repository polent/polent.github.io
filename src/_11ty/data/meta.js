module.exports = {
	projectName: "Recipes by Polente",
	description:
		"Recipes are full AI Generated - let me know if you have tried them, I tried some of them and they were delicious.",
	shortName: "Recipes @ Polente",
	domain:
		process.env.ELEVENTY_RUN_MODE == "serve"
			? "http://localhost:8080"
			: "https://recipe.polente.de",
	robots: "index, follow",
	themeColor: "#FFFFFF",
	backgroundColor: "#FFFFFF",
	author: {
		name: "Holger Hellinger",
		email: "sitte@polente.de",
	},
	identity: [
		{
			rel: "me",
			url: "https://polente.de",
		},
	],
	og: {
		locale: "en_GB",
		type: "website",
		image: {
			rel: "/og-default.png",
			alt: "Default OG image displayed here",
		},
	},
};
