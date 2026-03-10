const Image = require("@11ty/eleventy-img");

const picture = async function (
	src,
	title,
	alt,
	loading = "lazy",
	sizes = "(min-width: 64rem) 1024px, 100vw",
	fetchpriority = undefined
) {
	const metadata = await Image(src, {
		widths: [250, 440, 600, 1024, 1600, 2150],
		formats: ["avif", "jpeg"],
		urlPath: "/img/",
		outputDir: "./dist/img/",
		sharpAvifOptions: {
			quality: 60,
		},
		sharpJpegOptions: {
			quality: 60,
		},
	});

	const imageAttributes = {
		title,
		alt,
		sizes,
		loading,
	};

	if (fetchpriority) {
		imageAttributes.fetchpriority = fetchpriority;
	}

	return Image.generateHTML(metadata, imageAttributes);
};

const figure = function (content, caption, className) {
	let classVal = "";
	let captionVal = "";
	if (className !== undefined) {
		classVal = `class=${className}`;
	}
	if (caption !== undefined) {
		captionVal = `<figcaption>${caption}</figcaption>`;
	}
	return `<figure ${classVal}>${content}${captionVal}</figure>`;
};

module.exports = {
	picture,
	figure,
};
