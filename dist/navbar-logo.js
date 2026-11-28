"use strict";
(function() {
	// src/lib/page-variants.ts
	function altVariant(date) {
		if (date.getMonth() * 37 + date.getDate() - 112) return 0;
		return date.getFullYear() % 2 ? 1 : 2;
	}
	var ALT_LOGOS = ["assets/logo-alt.png", "assets/logo-alt2.png"];
	function applyLogo(image, alt) {
		if (alt) image.src = ALT_LOGOS[alt - 1];
	}
	// src/entries/navbar-logo.ts
	applyLogo(document.getElementById("navbar-logo"), altVariant(/* @__PURE__ */ new Date()));
})();
