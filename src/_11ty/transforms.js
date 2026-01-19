// Note: html-minifier@4.0.0 has a known REDoS vulnerability with no fix available
// Using PostCSS for CSS minification and basic HTML output instead
// const htmlMinifier = require("html-minifier");

const htmlmin = function (content) {
	// HTML minification disabled due to security vulnerability in html-minifier
	// PostCSS handles CSS minification via postcss.config.js
	return content;
};

module.exports = {
	htmlmin,
};
