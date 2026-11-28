"use strict";
(function() {
	// src/lib/url.ts
	function getParameterByName(name, url) {
		const escapedName = name.replace(/[[\]]/g, "\\$&");
		const results = new RegExp(`[?&]${escapedName}(=([^&#]*)|&|#|$)`).exec(url || window.location.href);
		if (!results) return null;
		if (!results[2]) return "";
		return decodeURIComponent(results[2].replace(/\+/g, " "));
	}
	// src/lib/catalog-loader.ts
	function coursesUrl(semester) {
		if (semester < "202401") return `https://ug.cheesefork.cf/courses_${semester}.min.js`;
		return `https://sap.cheesefork.cf/courses_${semester.slice(0, 4)}_${parseInt(semester.slice(4), 10) - 1 + 200}.min.js`;
	}
	function englishCatalogUrl(semester) {
		return `catalog-en/courses_${semester.slice(0, 4)}_${parseInt(semester.slice(4), 10) - 1 + 200}.min.js`;
	}
	function publishedSemesters(availableSemesters) {
		Object.keys(availableSemesters).forEach((key) => {
			if (key.slice(-1) === "_") delete availableSemesters[key];
		});
		return availableSemesters;
	}
	function storageGet(key) {
		try {
			return localStorage.getItem(key);
		} catch (e) {
			return null;
		}
	}
	function storageSet(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch (e) {}
	}
	function chooseSemester(availableSemesters) {
		let semester = getParameterByName("semester");
		if (!semester || !availableSemesters[semester]) {
			semester = storageGet("lastSelectedSemester");
			if (!semester || !availableSemesters[semester]) semester = Object.keys(availableSemesters).sort().pop();
		}
		return semester;
	}
	function isOwnSchedulePage(sharingUserId) {
		return sharingUserId === null && getParameterByName("course") === null && getParameterByName("staff") === null && getParameterByName("room") === null;
	}
	function writeScript(document, src, onerror) {
		const script = document.createElement("script");
		script.src = src;
		if (onerror) script.setAttribute("onerror", onerror);
		document.write(script.outerHTML);
	}
	var FIREBASE_UI_LOCALES = {
		he: "__iw",
		ar: "__ar"
	};
	function loadCatalog(window, document) {
		writeScript(document, `https://www.gstatic.com/firebasejs/ui/3.3.0/firebase-ui-auth${FIREBASE_UI_LOCALES[window.CheeseI18n.getLocale()] || ""}.js`);
		const semester = chooseSemester(publishedSemesters(window.availableSemesters));
		window.currentSemester = semester;
		window.scheduleSharingUserId = getParameterByName("uid");
		if (isOwnSchedulePage(window.scheduleSharingUserId)) storageSet("lastSelectedSemester", semester);
		writeScript(document, coursesUrl(semester), "alert(CheeseI18n.t(\"shell.error.loadCourses\"));");
		if (window.CheeseI18n.getLocale() === "en" && semester >= "202401") writeScript(document, englishCatalogUrl(semester));
	}
	// src/entries/index-catalog.ts
	loadCatalog(window, document);
})();
