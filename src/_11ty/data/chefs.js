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
	{
		name: "Jakob",
		tagName: "Jakob",
		slug: "jakob",
		region: "Black Forest, Germany",
		cuisine: "Central European",
		cuisineSchema: "Central European",
		portrait: "./src/media/chefs/jakob.jpg",
		portraitAlt:
			"Jakob in a bright, modern workshop-style kitchen with rustic wood counters, large fermentation jars on the shelves, and fresh root vegetables on the cutting board.",
		tagline: "Root vegetables, fermentation, and modern rustic classics",
		bio: "Jakob is a vegan chef from the Black Forest in Germany, dedicated to down-to-earth craftsmanship and the art of fermentation. He specialises in bringing out deep, complex flavours from native winter vegetables, foraged mushrooms, and fresh herbs, reimagining rustic Central European classics as vibrant plant-based dishes.",
		signature:
			"Modern rustic Central European — braised salsify in beer sauce, lentils with handmade spätzle, roasted savoy cabbage with mustard crust, potato-parsnip mash with crispy fried onions.",
	},
	{
		name: "Ananya",
		tagName: "Ananya",
		slug: "ananya",
		region: "Kerala / Gujarat, India",
		cuisine: "South Asian",
		cuisineSchema: "Indian",
		portrait: "./src/media/chefs/ananya.jpg",
		portraitAlt:
			"Ananya in a warm, sunlight-filled kitchen with brass cookware, stone spice grinders, and small bowls overflowing with turmeric, mustard seeds, and curry leaves.",
		tagline: "Aromatic spices, slow-simmered dals, and vibrant regional curries",
		bio: "Ananya is an Indian vegan chef celebrating the rich culinary heritage of Kerala and Gujarat. Her cooking showcases the extraordinary depth of whole spices and legumes — proving that traditional Indian cuisine needs no plant-based substitutes, having mastered vibrant, naturally plant-powered dishes for centuries.",
		signature:
			"Vegan Indian & South Asian — creamy chana masala, Kerala vegetable curry with toasted coconut and mustard seeds, crispy dosa with coconut chutney, yellow tadka dal with cumin.",
	},
];
