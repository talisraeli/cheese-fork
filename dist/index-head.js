"use strict";
(function() {
	// src/lib/page-variants.ts
	function altVariant(date) {
		if (date.getMonth() * 37 + date.getDate() - 112) return 0;
		return date.getFullYear() % 2 ? 1 : 2;
	}
	var ALT_FAVICONS = ["assets/favicon-alt.ico", "assets/favicon-alt2.ico"];
	function applyFavicon(document, alt) {
		if (!alt) return;
		document.querySelectorAll("link[data-favicon]").forEach((favicon) => favicon.remove());
		const link = document.createElement("link");
		link.rel = "icon";
		link.type = "image/x-icon";
		link.href = ALT_FAVICONS[alt - 1];
		document.head.appendChild(link);
	}
	function applyDirectionStyles(document, rtl) {
		document.querySelectorAll("link[data-dir]").forEach((link) => {
			link.disabled = link.getAttribute("data-dir") !== (rtl ? "rtl" : "ltr");
		});
	}
	// src/entries/index-head.ts
	applyDirectionStyles(document, CheeseI18n.isRTL());
	applyFavicon(document, altVariant(/* @__PURE__ */ new Date()));
})();
