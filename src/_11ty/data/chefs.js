// Chef registry. Single source of truth — drives /chefs/<slug>/, the chef directory
// at /our-chefs/, the recipe author URL in JSON-LD, and the homepage chef block.
// `tagName` matches the capitalised tag the AI cronjob writes as the last tag on
// each recipe (so `collections[chef.tagName]` returns that chef's recipes).

module.exports = [
	{
		name: "Emily",
		tagName: "Emily",
		slug: "emily",
		region: "California, USA",
		cuisine: "North American",
		cuisineSchema: "American",
		portrait: "./src/media/chefs/emily.jpg",
		portraitAlt:
			"Emily in a modern kitchen with rustic elements, grilling smoky BBQ tempeh ribs.",
		tagline: "Smoky, spicy, plant-powered BBQ",
		bio: "Emily is a vibrant vegan chef from California, known for her innovative approach to vegan BBQ. She loves experimenting with different plant-based proteins like tempeh and seitan to recreate classic American BBQ dishes. Her recipes often feature colorful, smoky, and spicy flavours.",
		signature:
			"Vegan BBQ — smoky tempeh ribs, grilled jackfruit pulled pork, charred-corn salads.",
	},
	{
		name: "Hiroshi",
		tagName: "Hiroshi",
		slug: "hiroshi",
		region: "Japan",
		cuisine: "Asian",
		cuisineSchema: "Japanese",
		portrait: "./src/media/chefs/hiroshi.jpg",
		portraitAlt:
			"Hiroshi in a sleek, minimalist kitchen, preparing a vegan sushi platter.",
		tagline: "Modern vegan takes on Asian classics",
		bio: "Hiroshi is a Japanese vegan chef with a passion for combining traditional Asian flavours with modern vegan ingredients. His specialty is creating delicious vegan sushi and noodle dishes — tofu, tempeh and a variety of fresh vegetables, all flavoured with classic Asian spices and sauces.",
		signature:
			"Vegan sushi and noodle dishes — vegan ramen, avocado-cucumber sushi rolls.",
	},
	{
		name: "Isabella",
		tagName: "Isabella",
		slug: "isabella",
		region: "Italy",
		cuisine: "Italian",
		cuisineSchema: "Italian",
		portrait: "./src/media/chefs/isabella.jpg",
		portraitAlt:
			"Isabella in a cozy, sunlit kitchen, tossing vegan pizza dough in a rustic setting.",
		tagline: "European comfort food, reimagined vegan",
		bio: "Isabella is an Italian vegan chef, celebrated for her ability to turn classic European dishes into delightful vegan experiences. She is particularly known for her vegan pastas and pizzas, using fresh, locally-sourced vegetables and homemade vegan cheeses.",
		signature:
			"Vegan Italian — creamy mushroom risotto, hand-tossed Neapolitan pizza with vegan mozzarella.",
	},
	{
		name: "Nia",
		tagName: "Nia",
		slug: "nia",
		region: "Kenya",
		cuisine: "African",
		cuisineSchema: "African",
		portrait: "./src/media/chefs/nia.jpg",
		portraitAlt:
			"Nia in a colorful kitchen adorned with African art, preparing a vegan Ethiopian lentil stew.",
		tagline: "Vibrant, hearty African plates",
		bio: "Nia is a Kenyan vegan chef whose cooking is deeply rooted in African culinary traditions. She specialises in creating vegan versions of African staples, using ingredients like millet, sorghum, and a variety of beans and legumes — vibrant, flavourful, often featuring aromatic spices and hearty textures.",
		signature:
			"Vegan African — Ethiopian lentil stew, Moroccan vegetable tagine, millet-based grain bowls.",
	},
];
