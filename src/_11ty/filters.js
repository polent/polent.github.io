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
	result = result.replace(/\.|\,|\?|-|—|\n/g, "");
	//remove repeated spaces
	result = result.replace(/[ ]{2,}/g, " ");

	return result;
}

module.exports = {
	dateToDMY,
	dateToYYYYMMDD,
	dateToTime,
	dateToYear,
	dateToMonth,
	dateToUNIX,
	squash,
};
