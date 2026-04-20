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

const wrapListItemsWithCheckboxes = sectionHtml => {
	if (!sectionHtml) {
		return { items: [], modifiedHtml: sectionHtml };
	}
	const items = [];
	let ingredientCounter = 0;

	let modifiedHtml = sectionHtml.replace(/<li([^>]*)>([\s\S]*?)<\/li>/gi, (full, attrs, inner) => {
		const cleaned = decodeHtmlEntities(stripHtml(inner)).replace(/\s+/g, " ").trim();
		if (!cleaned) return full;
		items.push(cleaned);
		const idx = ingredientCounter++;
		let newAttrs = attrs || "";
		if (/class=/.test(newAttrs)) {
			newAttrs = newAttrs.replace(/class=(['"])([^'"]*)\1/, (_, q, cls) => `class=${q}${cls} ingredient${q}`);
		} else {
			newAttrs = `${newAttrs} class="ingredient"`;
		}
		return `<li${newAttrs}><label class="ingredient-label"><input type="checkbox" class="ingredient-check" data-ingredient-index="${idx}" aria-label="Mark ingredient as acquired"><span class="ingredient-text">${inner}</span></label></li>`;
	});

	modifiedHtml = modifiedHtml.replace(/<ul(\s[^>]*)?>/i, (m, attrs = "") => {
		if (/class=/.test(attrs)) {
			return m.replace(/class=(['"])([^'"]*)\1/, (_, q, cls) => `class=${q}${cls} ingredients-list${q}`);
		}
		return `<ul${attrs || ""} class="ingredients-list">`;
	});

	return { items, modifiedHtml };
};

const extractListItemsWithIds = (sectionHtml, idPrefix = "step") => {
	if (!sectionHtml) {
		return { items: [], modifiedHtml: sectionHtml };
	}
	const items = [];
	let stepCounter = 0;

	let modifiedHtml = sectionHtml.replace(/<li([^>]*)>([\s\S]*?)<\/li>/gi, (full, attrs, inner) => {
		const cleaned = decodeHtmlEntities(stripHtml(inner)).replace(/\s+/g, " ").trim();
		if (!cleaned) return full;
		items.push(cleaned);
		stepCounter += 1;
		const stepId = `${idPrefix}${stepCounter}`;
		let newAttrs = attrs || "";
		if (/id=/i.test(newAttrs)) {
			newAttrs = newAttrs.replace(/id=(['"])[^'"]*\1/i, `id="${stepId}"`);
		} else {
			newAttrs = ` id="${stepId}"${newAttrs}`;
		}
		return `<li${newAttrs}>${inner}</li>`;
	});

	// Promote <ul> to <ol> so the instructions list is semantically ordered.
	// The recipe authoring convention uses * bullets, but steps are inherently ordered.
	modifiedHtml = modifiedHtml.replace(/<ul(\s[^>]*)?>([\s\S]*?)<\/ul>/i, (_, attrs, inner) => `<ol${attrs || ""}>${inner}</ol>`);

	return { items, modifiedHtml };
};

// Extract raw preparation time text from nutrition table (e.g. "1 hour 30 minutes")
const extractPrepTimeText = html => {
	if (!html) return null;
	const prepTimeMatch = html.match(/<th[^>]*>\s*Preparation Time\s*<\/th>\s*<td[^>]*>\s*([^<]+)\s*<\/td>/i);
	if (!prepTimeMatch || !prepTimeMatch[1]) return null;
	return prepTimeMatch[1].trim();
};

// Extract preparation time from nutrition table and convert to ISO 8601 format
const extractPrepTime = html => {
	if (!html) return null;

	// Look for "Preparation Time" row in table
	const prepTimeMatch = html.match(/<th[^>]*>\s*Preparation Time\s*<\/th>\s*<td[^>]*>\s*([^<]+)\s*<\/td>/i);
	if (!prepTimeMatch || !prepTimeMatch[1]) return null;

	const timeText = prepTimeMatch[1].trim().toLowerCase();
	
	// Convert text like "10 minutes" to "PT10M", "1 hour 30 minutes" to "PT1H30M"
	let hours = 0;
	let minutes = 0;
	
	// Extract hours
	const hourMatch = timeText.match(/(\d+)\s*hours?/);
	if (hourMatch) hours = parseInt(hourMatch[1]);
	
	// Extract minutes
	const minuteMatch = timeText.match(/(\d+)\s*minutes?/);
	if (minuteMatch) minutes = parseInt(minuteMatch[1]);
	
	if (hours === 0 && minutes === 0) return null;
	
	return `PT${hours > 0 ? hours + 'H' : ''}${minutes > 0 ? minutes + 'M' : ''}`;
};

// Extract nutrition information from nutrition table
const extractNutrition = html => {
	if (!html) return null;
	
	// Look for "Nutritionfacts" row in table
	const nutritionMatch = html.match(/<th[^>]*>\s*Nutritionfacts\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
	if (!nutritionMatch || !nutritionMatch[1]) return null;
	
	const nutritionText = stripHtml(nutritionMatch[1]).trim();
	
	// If nutrition info is empty, just says it's a source, or contains "None", return null
	if (!nutritionText || nutritionText.toLowerCase() === "none" || nutritionText.includes("source of") || nutritionText.includes("rich in")) {
		return null;
	}
	
	const nutrition = {
		"@type": "NutritionInformation"
	};
	
	// Parse each nutrition field
	const caloriesMatch = nutritionText.match(/calories[:\s]+(\d+(?:\.\d+)?)/i);
	if (caloriesMatch) {
		nutrition.calories = caloriesMatch[1];
	}
	
	const proteinMatch = nutritionText.match(/protein[:\s]+(\d+(?:\.\d+)?)\s*g/i);
	if (proteinMatch) {
		nutrition.proteinContent = `${proteinMatch[1]} g`;
	}
	
	const fatMatch = nutritionText.match(/total\s+fat[:\s]+(\d+(?:\.\d+)?)\s*g/i) || 
	                nutritionText.match(/fat[:\s]+(\d+(?:\.\d+)?)\s*g/i);
	if (fatMatch) {
		nutrition.fatContent = `${fatMatch[1]} g`;
	}
	
	const carbMatch = nutritionText.match(/(?:total\s+)?carbohydrate[:\s]+(\d+(?:\.\d+)?)\s*g/i);
	if (carbMatch) {
		nutrition.carbohydrateContent = `${carbMatch[1]} g`;
	}
	
	const fiberMatch = nutritionText.match(/(?:dietary\s+)?fiber[:\s]+(\d+(?:\.\d+)?)\s*g/i);
	if (fiberMatch) {
		nutrition.fiberContent = `${fiberMatch[1]} g`;
	}
	
	const sodiumMatch = nutritionText.match(/sodium[:\s]+(\d+(?:\.\d+)?)\s*mg/i);
	if (sodiumMatch) {
		nutrition.sodiumContent = `${sodiumMatch[1]} mg`;
	}
	
	const sugarMatch = nutritionText.match(/sugar[:\s]+(\d+(?:\.\d+)?)\s*g/i);
	if (sugarMatch) {
		nutrition.sugarContent = `${sugarMatch[1]} g`;
	}
	
	// Return null if no nutrition fields were found
	if (Object.keys(nutrition).length === 1) {
		return null;
	}
	
	return nutrition;
};

// Extract yield information from nutrition table
const extractYield = html => {
	if (!html) return null;
	
	// Look for "Yield" row in table
	const yieldMatch = html.match(/<th[^>]*>\s*Yield\s*<\/th>\s*<td[^>]*>\s*([^<]+)\s*<\/td>/i);
	if (!yieldMatch || !yieldMatch[1]) return null;
	
	const yieldText = stripHtml(yieldMatch[1]).trim();
	
	// If yield info is empty or "none", return null
	if (!yieldText || yieldText.toLowerCase() === "none") {
		return null;
	}
	
	return yieldText;
};

function extractRecipeData(html, recipeUrl) {
	const result = {
		image: null,
		ingredients: [],
		instructions: [],
		prepTime: null,
		prepTimeText: null,
		nutrition: null,
		yield: null,
		modifiedHtml: html,
	};

	if (!html) {
		return result;
	}

	const imageMatch = html.match(/<img[^>]*src=['"]([^'"]+)['"][^>]*>/i);
	if (imageMatch) {
		result.image = imageMatch[1];
	}

	// Extract prep time and nutrition early
	result.prepTime = extractPrepTime(html);
	result.prepTimeText = extractPrepTimeText(html);
	result.nutrition = extractNutrition(html);
	result.yield = extractYield(html);

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
		const { items: ingredientItems, modifiedHtml: modifiedIngredientsHtml } = wrapListItemsWithCheckboxes(ingredientsSection.sectionHtml);
		result.ingredients = ingredientItems;
		result.modifiedHtml = result.modifiedHtml.replace(ingredientsSection.sectionHtml, modifiedIngredientsHtml);
	}

	const instructionsSection = headings.find(heading => heading.title === "instructions");
	if (instructionsSection) {
		const { items: instructionTexts, modifiedHtml: modifiedInstructionsHtml } = extractListItemsWithIds(instructionsSection.sectionHtml, "step");
		result.instructions = instructionTexts.map((text, index) => {
			const stepNumber = index + 1;
			const stepObject = {
				"@type": "HowToStep",
				text,
			};
			if (recipeUrl) {
				stepObject.url = recipeUrl + `#step${stepNumber}`;
			}
			return stepObject;
		});
		
		// Update the modified HTML in the result
		result.modifiedHtml = result.modifiedHtml.replace(instructionsSection.sectionHtml, modifiedInstructionsHtml);
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
