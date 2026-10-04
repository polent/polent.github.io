(() => {
	"use strict";

	const section = document.querySelector(".comments");
	if (!section) return;

	const WIDGET_SRC = "https://cdn.echothread.io/widget.js";

	const gate = section.querySelector("[data-comments-gate]");
	const button = section.querySelector('[data-action="comments-load"]');
	const status = section.querySelector("[data-comments-status]");
	const title = section.querySelector("#comments-title");
	const mount = document.getElementById("echothread");
	if (!gate || !button || !mount) return;

	const say = text => {
		if (status) status.textContent = text;
	};

	button.addEventListener(
		"click",
		() => {
			/* No data-theme on purpose. Colours come from comments.css. Without the
			   attribute the widget reads the page background for light/dark and re-reads
			   it on every prefers-color-scheme change. Setting it would lock the mode. */

			/* Removing the focused button would drop focus to <body>. */
			gate.remove();
			if (title) title.focus();
			say("Loading comments…");

			const script = document.createElement("script");
			script.src = WIDGET_SRC;
			script.async = true;
			script.onload = () => say("Comments loaded.");
			script.onerror = () => say("Comments could not be loaded. Please try again later.");
			document.body.append(script);
		},
		{ once: true },
	);
})();
