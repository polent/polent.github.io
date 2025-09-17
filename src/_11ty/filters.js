const { DateTime } = require("luxon");

// Add ordinal suffix to day
const addSuffix = i => {
	const s = ["th", "st", "nd", "rd"];
	const v = i % 100;
	return i + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Return day/month/year (with suffix)
function dateToDMY(i) {
	const getDay = DateTime.fromJSDate(i).toFormat("d").toString();
	const getDayWithSuffix = addSuffix(getDay);
	const getMonth = DateTime.fromJSDate(i).toFormat("LLLL").toString();
	const getYear = DateTime.fromJSDate(i).toFormat("y").toString();
	return `${getDayWithSuffix} ${getMonth} ${getYear}`;
}

function dateToYYYYMMDD(i) {
	const getDay = DateTime.fromJSDate(i).toFormat("dd").toString();
	const getMonth = DateTime.fromJSDate(i).toFormat("MM").toString();
	const getYear = DateTime.fromJSDate(i).toFormat("y").toString();
	return `${getYear}-${getMonth}-${getDay}`;
}

// Return time
function dateToTime(i) {
	return DateTime.fromJSDate(i).toFormat("HH':'mm").toString();
}

// Return just year
function dateToYear(i) {
	return DateTime.fromJSDate(i).toFormat("y").toString();
}

// Return just month
function dateToMonth(i) {
	return DateTime.fromJSDate(i).toFormat("LL").toString();
}

// Return UNIX
function dateToUNIX(i) {
	return DateTime.fromJSDate(i).toFormat("x").toString();
}

function squash(text) {
	var content = new String(text);

	// all lower case, please
	var content = content.toLowerCase();

	// remove all html elements and new lines
	var re = /(&lt;.*?&gt;)/gi;
	var plain = unescape(content.replace(re, ""));

	// remove duplicated words
	var words = plain.split(" ");
	var deduped = [...new Set(words)];
	var dedupedStr = deduped.join(" ");

	// remove short and less meaningful words
	var result = dedupedStr.replace(
		/\b(\.|\,|the|a|an|and|am|you|I|to|if|of|off|me|my|on|in|it|is|at|as|we|do|be|has|but|was|so|no|not|or|up|for)\b/gi,
		""
	);
	//remove newlines, and punctuation
	result = result.replace(/\.|\,|\?|-|-|\n/g, "");
	//remove repeated spaces
	result = result.replace(/[ ]{2,}/g, " ");

	return result;
}

const htmlEntityMap = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&nbsp;": " ",
};

const decodeNumericEntity = entity => {
	const numericMatch = entity.match(/&#(\d+);/);
	if (numericMatch) {
		return String.fromCharCode(Number(numericMatch[1]));
	}
	return entity;
};

const decodeHtmlEntities = value => {
	if (!value) {
		return "";
	}
	return value.replace(/&#?\w+;/g, entity => htmlEntityMap[entity] || decodeNumericEntity(entity));
};

const stripHtml = value => {
	if (!value) {
		return "";
	}
	return value.replace(/<[^>]*>/g, "");
};

const extractListItems = sectionHtml => {
	if (!sectionHtml) {
		return [];
	}
	const items = [];
	const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
	let match = listItemRegex.exec(sectionHtml);
	while (match) {
		const cleaned = decodeHtmlEntities(stripHtml(match[1])).replace(/\s+/g, " ").trim();
		if (cleaned) {
			items.push(cleaned);
		}
		match = listItemRegex.exec(sectionHtml);
	}
	return items;
};

function extractRecipeData(html) {
	const result = {
		image: null,
		ingredients: [],
		instructions: [],
	};

	if (!html) {
		return result;
	}

	const imageMatch = html.match(/<img[^>]*src=['"]([^'"]+)['"][^>]*>/i);
	if (imageMatch) {
		result.image = imageMatch[1];
	}

	const headings = [];
	const headingRegex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
	let headingMatch = headingRegex.exec(html);
	while (headingMatch) {
		const headingText = decodeHtmlEntities(stripHtml(headingMatch[1])).toLowerCase().trim();
		headings.push({
			title: headingText,
			headingIndex: headingMatch.index,
			contentStart: headingMatch.index + headingMatch[0].length,
		});
		headingMatch = headingRegex.exec(html);
	}

	for (let index = 0; index < headings.length; index += 1) {
		const current = headings[index];
		const next = headings[index + 1];
		const endIndex = next ? next.headingIndex : html.length;
		current.sectionHtml = html.slice(current.contentStart, endIndex);
	}

	const ingredientsSection = headings.find(heading => heading.title === "ingredients");
	if (ingredientsSection) {
		result.ingredients = extractListItems(ingredientsSection.sectionHtml);
	}

	const instructionsSection = headings.find(heading => heading.title === "instructions");
	if (instructionsSection) {
		result.instructions = extractListItems(instructionsSection.sectionHtml).map(text => ({
			"@type": "HowToStep",
			text,
		}));
	}

	return result;
}

function toJson(value) {
	if (value === undefined) {
		return "";
	}
	const replacer = (key, val) => {
		if (val === undefined || val === null) {
			return undefined;
		}
		return val;
	};
	return JSON.stringify(value, replacer, 2);
}

module.exports = {
	dateToDMY,
	dateToYYYYMMDD,
	dateToTime,
	dateToYear,
	dateToMonth,
	dateToUNIX,
	squash,
	extractRecipeData,
	toJson,
};
