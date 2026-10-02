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
			/* The site follows prefers-color-scheme, so the widget does too. Read once at
			   load time: the widget takes its theme from the attribute when it starts. */
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				mount.dataset.theme = "dark";
			}

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
