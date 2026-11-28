"use strict";
var CheeseForkCourseManager = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	// src/lib/template.ts
	function escapeHtml(value) {
		return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}
	function render(template, values) {
		return template.replace(/\s*\n\s*/g, "").replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}|\{\{t:([\w.-]+)\}\}/g, (match, raw, escaped, key) => {
			if (key) return escapeHtml(CheeseI18n.t(key));
			const name = raw || escaped;
			const value = values ? values[name] : void 0;
			if (value === void 0 || value === null) throw new Error(`Missing template value: ${name}`);
			return raw ? String(value) : escapeHtml(value);
		});
	}
	// src/lib/templates/course-link.html?cheesefork-template
	var course_link_default = "<a href=\"{{url}}\" target=\"_blank\" rel=\"noopener\" data-gtag-event=\"{{event}}\"><img src=\"{{icon}}\" alt=\"\" width=\"16\" height=\"16\"> {{label}}</a>\n";
	// src/lib/templates/whatsapp-link.html?cheesefork-template
	var whatsapp_link_default = "<a href=\"#\" class=\"whatsapp-group-link\" data-gtag-event=\"{{event}}\"><img src=\"assets/icon-whatsapp.png\" alt=\"\" width=\"16\" height=\"16\"> {{t:courses.links.groups}}</a>\n";
	// src/lib/course-description.ts
	function getDescription(that, course, options) {
		const general = that.coursesHashmap[course].general;
		let header = that.getTitle(course);
		let headerHtml = options.html ? sourceHtml(header) : "";
		let content = "";
		let contentHtml = "";
		function escapeHtml(value) {
			return $("<div>").text(value).html();
		}
		function sourceHtml(value) {
			return $("<span>", {
				class: "source-content",
				lang: /[א-ת]/.test(value) ? "he" : "en",
				dir: "auto",
				text: value
			})[0].outerHTML.replace(/\n/g, "<br>");
		}
		function addHeader(key, value) {
			const label = `${that.getFieldLabel(key)}: `;
			header += `\n${label}${value}`;
			if (options.html) headerHtml += `<br>${escapeHtml(label)}${/[א-ת]/.test(value) ? sourceHtml(value) : escapeHtml(value)}`;
		}
		function addContent(key, value, separator) {
			const label = key ? `${that.getFieldLabel(key)}: ` : "";
			content += separator + label + value;
			if (options.html) contentHtml += separator.replace(/\n/g, "<br>") + escapeHtml(label) + sourceHtml(value);
		}
		if (general["פקולטה"]) {
			const faculty = that.getFacultyLabel(general["פקולטה"]);
			addHeader("פקולטה", faculty === general["פקולטה"] ? that.getEnglishText(course, "faculty") || faculty : faculty);
		}
		if (general["מסגרת לימודים"]) {
			const frameworks = general["מסגרת לימודים"].split("\n");
			const frameworkLabels = frameworks.map((framework) => that.getFrameworkLabel(framework));
			addHeader("מסגרת לימודים", frameworkLabels.some((label, i) => label === frameworks[i]) && that.getEnglishText(course, "level") || frameworkLabels.join(", "));
		}
		if (general["נקודות"]) addHeader("נקודות", general["נקודות"]);
		if (general["סילבוס"]) addContent(null, that.getEnglishText(course, "syllabus") || general["סילבוס"], "\n\n");
		if (options.relatedCourseInfo) [
			"מקצועות קדם",
			"מקצועות צמודים",
			"מקצועות זהים",
			"מקצועות ללא זיכוי נוסף (מוכלים)",
			"מקצועות ללא זיכוי נוסף (מכילים)",
			"מקצועות ללא זיכוי נוסף"
		].forEach((key) => {
			if (general[key]) {
				let value = general[key].replace(/(ו-)\s+/g, "$1").replace(/(\()\s+/g, "$1").replace(/\s+(\))/g, "$1").replace(/\s+/g, " ").trim();
				if (!isCatalogLanguage()) value = value.replace(/(^|[\s(])או(?=$|[\s()])/g, `$1${CheeseI18n.t("courses.expression.or")}`).replace(/(^|[\s(])ו-\s*(?=\d|\()/g, `$1${CheeseI18n.t("courses.expression.and")} `);
				addContent(key, value, "\n\n");
			}
		});
		if (general["אחראים"]) addContent("אחראים", that.getEnglishText(course, "coordinators") || general["אחראים"], "\n\n");
		[[
			"בוחן מועד א",
			"בוחן מועד ב",
			"בוחן מועד ג",
			"בוחן מועד ד",
			"בוחן מועד ה",
			"בוחן מועד ו"
		], [
			"מועד א",
			"מועד ב",
			"מועד ג"
		]].forEach((keys) => {
			let first = true;
			keys.forEach((key) => {
				if (general[key]) {
					let value = general[key].replace(/\n\n/g, "\n========\n");
					if (!isCatalogLanguage()) value = value.split("\n").map((line) => line.replace(/^בתאריך (\d+)\.(\d+)\.(\d+)(?: יום ([א-ו]) משעה (\d+(?::\d+)?) עד השעה (\d+(?::\d+)?))?/, (match, day, month, year, weekday, start, end) => {
						let label = `${day}/${month}/${year}`;
						if (weekday) label += ` ${that.getDayLabel(weekday)} ${start}–${end}`;
						return label;
					})).join("\n");
					addContent(key, value, first ? "\n\n" : "\n");
					first = false;
				}
			});
		});
		if (general["הערות"]) addContent("הערות", that.getEnglishText(course, "notes") || general["הערות"], "\n\n");
		if (!options.html) return header + content;
		let linksHtml = "";
		if (options.links) {
			const link = (event, url, icon, labelKey) => render(course_link_default, {
				url,
				icon,
				label: CheeseI18n.t(labelKey),
				event: options.logging ? event : ""
			});
			if (currentSemester < "202401") linksHtml += `<br><br>${link("info-click-link-rishum", `https://students.technion.ac.il/local/technionsearch/course/${course}`, "assets/icon-students.png", "courses.links.studentPortal")}`;
			else {
				const currentSemesterYear = currentSemester.slice(0, 4);
				const currentSemesterSapSemester = parseInt(currentSemester.slice(4), 10) - 1 + 200;
				const sapLanguage = CheeseI18n.getLocale() === "en" ? "EN" : "HE";
				linksHtml += `<br><br>${link("info-click-link-sap", `https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=${sapLanguage}&sap-ui-language=${sapLanguage}#/details/${currentSemesterYear}/${currentSemesterSapSemester}/SM/${course}`, "assets/icon-sap.png", "courses.links.catalog")}`;
			}
			if (that.isComputerScienceCourse(course)) linksHtml += `<br>${link("info-click-link-webcourse", `https://webcourse.cs.technion.ac.il/${course}/`, "assets/icon-webcourse.png", "courses.links.webcourse")}`;
			linksHtml += `<br>${link("info-click-link-facebook", `https://www.facebook.com/search/groups/?q=${that.toOldCourseNumber(course)}`, "assets/icon-facebook.png", "courses.links.facebook")}`;
			linksHtml += `<br>${link("info-click-link-tscans", `https://scans.cheesefork.cf/?course=${course}`, "assets/icon-scans.png", "courses.links.examScans")}`;
			if (options.whatsappGroupLink) linksHtml += `<br>${render(whatsapp_link_default, { event: options.logging ? "info-click-link-whatsapp" : "" })}`;
		}
		return headerHtml + linksHtml + contentHtml;
	}
	// src/lib/course-filter.ts
	function filterCourses(that, filters) {
		const filtered = [];
		let i;
		const moedAMin = filters.moedAMin ? moment.utc(filters.moedAMin).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const moedAMax = filters.moedAMax ? moment.utc(filters.moedAMax).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const moedBMin = filters.moedBMin ? moment.utc(filters.moedBMin).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const moedBMax = filters.moedBMax ? moment.utc(filters.moedBMax).set({
			hour: 0,
			minute: 0,
			second: 0
		}) : null;
		const currentMoedADates = [];
		if (filters.moedADaysMin && filters.coursesCurrent) filters.coursesCurrent.forEach((course) => {
			const general = that.coursesHashmap[course].general;
			if (general["מועד א"]) {
				const dateTimeA = that.parseExamDateTime(general["מועד א"]);
				if (dateTimeA) {
					const moedA = moment.utc(dateTimeA.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					currentMoedADates.push(moedA);
				}
			}
		});
		const currentMoedBDates = [];
		if (filters.moedBDaysMin && filters.coursesCurrent) filters.coursesCurrent.forEach((course) => {
			const general = that.coursesHashmap[course].general;
			if (general["מועד ב"]) {
				const dateTimeB = that.parseExamDateTime(general["מועד ב"]);
				if (dateTimeB) {
					const moedB = moment.utc(dateTimeB.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					currentMoedBDates.push(moedB);
				}
			}
		});
		Object.keys(that.coursesHashmap).forEach((course) => {
			const general = that.coursesHashmap[course].general;
			if (filters.coursesLimit && !filters.coursesLimit.includes(course)) return;
			if (filters.coursesExclude && filters.coursesExclude.includes(course)) return;
			if (filters.faculties && general["פקולטה"] && !filters.faculties.includes(general["פקולטה"])) return;
			const frameworks = filters.frameworks;
			if (frameworks && general["מסגרת לימודים"]) {
				if (!general["מסגרת לימודים"].split("\n").some((item) => frameworks.includes(item))) return;
			}
			if (general["נקודות"]) {
				const points = parseFloat(general["נקודות"]);
				if (filters.pointsMin !== void 0 && points < filters.pointsMin) return;
				if (filters.pointsMax !== void 0 && points > filters.pointsMax) return;
			}
			if (filters.filterPrerequisites && general["מקצועות קדם"]) {
				if (!filters.coursesTaken) return;
				const booleanExpression = general["מקצועות קדם"].replace(/\s/g, "").replace(/או/g, " OR ").replace(/ו-/g, " AND ");
				if (!new BooleanExpression(booleanExpression).test(filters.coursesTaken)) return;
			}
			if (filters.filterLinkedCourses && general["מקצועות צמודים"]) {
				if (!filters.coursesTaken && !filters.coursesCurrent) return;
				const linkedCourses = general["מקצועות צמודים"].match(/\d+/g);
				if (linkedCourses) for (i = 0; i < linkedCourses.length; i++) if (filters.coursesTaken && !filters.coursesTaken.includes(linkedCourses[i]) || filters.coursesCurrent && !filters.coursesCurrent.includes(linkedCourses[i])) {} else return;
			}
			if (filters.filterOverlappingCourses && (filters.coursesTaken || filters.coursesCurrent)) {
				if (filters.coursesTaken && filters.coursesTaken.includes(course)) return;
				if (filters.coursesCurrent && filters.coursesCurrent.includes(course)) return;
				let overlappingCourses = [];
				[
					"מקצועות זהים",
					"מקצועות ללא זיכוי נוסף (מוכלים)",
					"מקצועות ללא זיכוי נוסף (מכילים)",
					"מקצועות ללא זיכוי נוסף"
				].forEach((key) => {
					if (general[key]) {
						const overlappingCoursesPart = general[key].match(/\d+/g);
						if (overlappingCoursesPart) overlappingCourses = overlappingCourses.concat(overlappingCoursesPart);
					}
				});
				for (i = 0; i < overlappingCourses.length; i++) {
					if (filters.coursesTaken && filters.coursesTaken.includes(overlappingCourses[i])) return;
					if (filters.coursesCurrent && filters.coursesCurrent.includes(overlappingCourses[i])) return;
				}
			}
			if ((moedAMin || moedAMax || filters.moedADaysMin) && general["מועד א"]) {
				const dateTimeA = that.parseExamDateTime(general["מועד א"]);
				if (dateTimeA) {
					const moedA = moment.utc(dateTimeA.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					if (moedAMin && moedA.isBefore(moedAMin) || moedAMax && moedA.isAfter(moedAMax)) return;
					if (filters.moedADaysMin) {
						for (i = 0; i < currentMoedADates.length; i++) if (Math.abs(moedA.diff(currentMoedADates[i], "days")) < filters.moedADaysMin) return;
					}
				}
			}
			if ((moedBMin || moedBMax || filters.moedBDaysMin) && general["מועד ב"]) {
				const dateTimeB = that.parseExamDateTime(general["מועד ב"]);
				if (dateTimeB) {
					const moedB = moment.utc(dateTimeB.start).set({
						hour: 0,
						minute: 0,
						second: 0
					});
					if (moedBMin && moedB.isBefore(moedBMin) || moedBMax && moedB.isAfter(moedBMax)) return;
					if (filters.moedBDaysMin) {
						for (i = 0; i < currentMoedBDates.length; i++) if (Math.abs(moedB.diff(currentMoedBDates[i], "days")) < filters.moedBDaysMin) return;
					}
				}
			}
			if (filters.filterWithExam && (general["מועד א"] || general["מועד ב"])) return;
			if (filters.filterWithoutExam && !general["מועד א"] && !general["מועד ב"]) return;
			filtered.push(course);
		});
		return filtered;
	}
	// src/lib/course-number.ts
	function toNewCourseNumber(course) {
		let match = /^9730(\d\d)$/.exec(course);
		if (match) return `970300${match[1]}`;
		match = /^(\d\d\d)(\d\d\d)$/.exec(course);
		if (match) return `0${match[1]}0${match[2]}`;
		return course;
	}
	// src/lib/course-manager.ts
	function translated(keys, value) {
		return Object.prototype.hasOwnProperty.call(keys, value) ? CheeseI18n.t(keys[value]) : value;
	}
	var CourseManager = class {
		constructor(allCourses, englishCatalog) {
			this.coursesHashmap = {};
			this.coursesScheduleProcessed = {};
			this.englishCatalog = englishCatalog || null;
			allCourses.forEach((item) => {
				this.coursesHashmap[item.general["מספר מקצוע"]] = item;
			});
		}
		doesExist(course) {
			return course in this.coursesHashmap;
		}
		toOldCourseNumber(course) {
			let match = /^970300(\d\d)$/.exec(course);
			if (match) return `9730${match[1]}`;
			if (/^097300\d\d$/.exec(course)) return course;
			match = /^0(\d\d\d)0(\d\d\d)$/.exec(course);
			if (match) return match[1] + match[2];
			return course;
		}
		toNewCourseNumber(course) {
			return toNewCourseNumber(course);
		}
		toSemesterFormatCourseNumber(course) {
			if (currentSemester < "202401") return this.toOldCourseNumber(course);
			else return this.toNewCourseNumber(course);
		}
		isComputerScienceCourse(course) {
			return /^(23\d\d\d\d|023\d\d\d\d\d)$/.test(course);
		}
		stringToCourseNumber(str) {
			if (!str || !/^[0-9]{1,8}$/.test(str)) return null;
			if (str.length <= 6) return `00000${str}`.slice(-6);
			else return `0000000${str}`.slice(-8);
		}
		getAllCourses() {
			return Object.keys(this.coursesHashmap);
		}
		getCourseData(course) {
			if (!this.coursesScheduleProcessed[course]) this.getSchedule(course);
			return this.coursesHashmap[course];
		}
		getGeneralInfo(course) {
			return this.coursesHashmap[course].general;
		}
		getSchedule(course) {
			if (!this.coursesScheduleProcessed[course]) {
				this.coursesHashmap[course].schedule = this.processSchedule(course);
				this.coursesScheduleProcessed[course] = true;
			}
			return this.coursesHashmap[course].schedule;
		}
		processSchedule(course) {
			const general = this.coursesHashmap[course].general;
			let schedule = this.coursesHashmap[course].schedule;
			if (general["הערות"]) {
				let comment = general["הערות"];
				comment = comment.replace(/(^|[^א-ת])(ה?ס)(דנ|ד|נ)(א|ה|אות)($|[^א-ת])/g, "$1$2דנ$4$5");
				comment = comment.replace(/^(סדנת רשות:)\s*(ב?ימי|יום)(\s)/gm, "$1\n$2$3");
				const commentLines = comment.split("\n");
				for (let i = 0; i < commentLines.length; i++) {
					let line = commentLines[i];
					if (line.match(/^(\d+\.\s*)?סדנ(ת|ה|א|אות)[: ]/)) {
						let workshopsTa = "";
						let match = /(?:\n|^)מתרגל[ית]? ה?סדנ(?:א|ה|אות).*?:\s*([\s\S]*?)\s*(?:=|\n\d+\.|$)/.exec(comment);
						if (match) workshopsTa = match[1].replace(/\s+/g, " ").replace(/(\((גם אחראי[תם]?|\d+)\)\s*)+,?/g, ",").replace(/\s*,\s*/g, "\n").trim();
						const workshops = [];
						let workshopId = 101;
						for (i++; i < commentLines.length; i++) {
							line = commentLines[i];
							match = /^ב?(?:ימי|יום) ([א-ת]+)'?,?\s*(\d+)[.:](\d+)-(\d+)[.:](\d+)(?:\s*,\s*(.*?)(?:\s+(\d+))?(?:\s*,\s*(.*?))?)?\.?$/.exec(line);
							if (!match) break;
							const day = {
								ראשון: "ראשון",
								שני: "שני",
								שלישי: "שלישי",
								רביעי: "רביעי",
								חמישי: "חמישי",
								שישי: "שישי",
								א: "ראשון",
								ב: "שני",
								ג: "שלישי",
								ד: "רביעי",
								ה: "חמישי",
								ו: "שישי"
							}[match[1]];
							if (!day) break;
							if (match[6] && !match[7] && match[8] && /^\d+$/.test(match[8])) {
								match[7] = match[8];
								match[8] = "";
							}
							let building = match[6] || "";
							switch (building) {
								case "פ'":
									building = "פישבך";
									break;
								case "מ'": building = "מאייר";
							}
							const startTime = `${match[2]}:${match[3]}`;
							const endTime = `${match[4]}:${match[5]}`;
							let time = `${startTime} - ${endTime}`;
							const timeParsed = this.parseLessonTime(time);
							if (timeParsed && timeParsed.end !== "00:00" && timeParsed.start > timeParsed.end) time = `${endTime} - ${startTime}`;
							workshops.push({
								קבוצה: workshopId,
								"מס.": workshopId,
								סוג: "sadna",
								"מרצה/מתרגל": match[8] || workshopsTa,
								יום: day,
								שעה: time,
								בניין: building,
								חדר: match[7] || ""
							});
							workshopId++;
						}
						if (workshops.length > 0) schedule = schedule.concat(workshops);
						break;
					}
				}
			}
			return schedule;
		}
		getTitle(course) {
			return `${this.coursesHashmap[course].general["מספר מקצוע"]} – ${this.getCourseName(course)}`;
		}
		getEnglishText(course, field) {
			const courses = this.englishCatalog && this.englishCatalog.courses;
			const text = courses && Object.prototype.hasOwnProperty.call(courses, course) && courses[course][field];
			return typeof text === "string" && text !== "" ? text : null;
		}
		getCourseName(course) {
			return this.getEnglishText(course, "name") || this.coursesHashmap[course].general["שם מקצוע"];
		}
		getStaffLabel(name) {
			return englishCatalogLabel(this.englishCatalog, "staff", name);
		}
		getBuildingLabel(building) {
			return englishCatalogLabel(this.englishCatalog, "buildings", building);
		}
		getFieldLabel(key) {
			return translated({
				"מספר מקצוע": "courses.fields.number",
				"שם מקצוע": "courses.fields.name",
				פקולטה: "courses.fields.faculty",
				"מסגרת לימודים": "courses.fields.framework",
				נקודות: "courses.fields.credits",
				סילבוס: "courses.fields.syllabus",
				"מקצועות קדם": "courses.fields.prerequisites",
				"מקצועות צמודים": "courses.fields.corequisites",
				"מקצועות זהים": "courses.fields.equivalentCourses",
				"מקצועות ללא זיכוי נוסף (מוכלים)": "courses.fields.noAdditionalCreditIncluded",
				"מקצועות ללא זיכוי נוסף (מכילים)": "courses.fields.noAdditionalCreditIncluding",
				"מקצועות ללא זיכוי נוסף": "courses.fields.noAdditionalCredit",
				אחראים: "courses.fields.coordinators",
				הערות: "courses.fields.remarks",
				"מרצה/מתרגל": "courses.fields.staff",
				יום: "courses.fields.day",
				שעה: "courses.fields.time",
				בניין: "courses.fields.building",
				חדר: "courses.fields.room",
				קבוצה: "courses.fields.group",
				"מס.": "courses.fields.lessonNumber",
				סוג: "courses.fields.lessonType",
				"אתר הקורס": "courses.fields.website",
				"עבור לסמסטר": "courses.fields.semester",
				מיקום: "courses.fields.location",
				"מועד הבחינה": "courses.fields.examDate",
				הרצאה: "courses.fields.lectureHours",
				תרגיל: "courses.fields.tutorialHours",
				מעבדה: "courses.fields.laboratoryHours",
				"סמינר/פרויקט": "courses.fields.seminarProjectHours",
				"בוחן מועד א": "courses.fields.testSession1",
				"בוחן מועד ב": "courses.fields.testSession2",
				"בוחן מועד ג": "courses.fields.testSession3",
				"בוחן מועד ד": "courses.fields.testSession4",
				"בוחן מועד ה": "courses.fields.testSession5",
				"בוחן מועד ו": "courses.fields.testSession6",
				"מועד א": "courses.fields.examSession1",
				"מועד ב": "courses.fields.examSession2",
				"מועד ג": "courses.fields.examSession3"
			}, key);
		}
		getLessonTypeLabel(value) {
			if (isCatalogLanguage() && value !== "sadna") return value;
			return translated({
				הרצאה: "courses.lessonTypes.lecture",
				תרגול: "courses.lessonTypes.tutorial",
				תרגיל: "courses.lessonTypes.tutorial",
				מעבדה: "courses.lessonTypes.laboratory",
				סמינר: "courses.lessonTypes.seminar",
				פרויקט: "courses.lessonTypes.project",
				"סמינר/פרויקט": "courses.lessonTypes.seminarProject",
				סדנה: "courses.lessonTypes.workshop",
				sadna: "courses.lessonTypes.workshop"
			}, value);
		}
		getDayLabel(value) {
			if (isCatalogLanguage()) return value;
			return translated({
				ראשון: "calendar.days.sunday",
				שני: "calendar.days.monday",
				שלישי: "calendar.days.tuesday",
				רביעי: "calendar.days.wednesday",
				חמישי: "calendar.days.thursday",
				שישי: "calendar.days.friday",
				שבת: "calendar.days.saturday",
				א: "calendar.days.sunday",
				ב: "calendar.days.monday",
				ג: "calendar.days.tuesday",
				ד: "calendar.days.wednesday",
				ה: "calendar.days.thursday",
				ו: "calendar.days.friday",
				ש: "calendar.days.saturday"
			}, value);
		}
		getFacultyLabel(value) {
			if (isCatalogLanguage()) return value;
			return translated({
				"המחלקה ללימודים הומניסטיים ואמנות": "courses.faculties.humanities",
				"הנדסה ימית": "courses.faculties.marineEngineering",
				"הפקולטה לארכיטקטורה ובינוי ערים": "courses.faculties.architecture",
				"הפקולטה לביולוגיה": "courses.faculties.biology",
				"הפקולטה להנדסה אזרחית וסביבתית": "courses.faculties.civilEnvironmental",
				"הפקולטה להנדסה ביו-רפואית": "courses.faculties.biomedical",
				"הפקולטה להנדסה כימית": "courses.faculties.chemical",
				"הפקולטה להנדסת אווירונוטיקה וחלל": "courses.faculties.aerospace",
				"הפקולטה להנדסת ביוטכנולוגיה ומזון": "courses.faculties.biotechnologyFood",
				"הפקולטה להנדסת חשמל ומחשבים": "courses.faculties.electricalComputer",
				"הפקולטה להנדסת מכונות": "courses.faculties.mechanical",
				"הפקולטה לכימיה": "courses.faculties.chemistry",
				"הפקולטה למדע והנדסה של חומרים": "courses.faculties.materials",
				"הפקולטה למדעי המחשב": "courses.faculties.computerScience",
				"הפקולטה למדעי הנתונים וההחלטות": "courses.faculties.dataDecision",
				"הפקולטה למתמטיקה": "courses.faculties.mathematics",
				"הפקולטה לפיזיקה": "courses.faculties.physics",
				"הפקולטה לרפואה": "courses.faculties.medicine",
				"חינוך למדע וטכנולוגיה": "courses.faculties.education",
				"מדע יישומי (ג'ייקובס-קורנל)": "courses.faculties.appliedScience",
				"מערכות אוטונומיות ורובוטיקה": "courses.faculties.autonomousRobotics",
				"מתמטיקה שימושית": "courses.faculties.appliedMathematics",
				"ננו-מדעים וננו-טכנולוגיה": "courses.faculties.nanoscience",
				"תוכנית האנרגיה ע\"ש גרנד": "courses.faculties.energy",
				"הפקולטה להנדסת חשמל": "courses.faculties.electrical",
				"הפקולטה להנדסת תעשייה וניהול": "courses.faculties.industrialManagement",
				"הפקולטה להנדסת חומרים": "courses.faculties.materials",
				"המחלקה לחינוך למדע וטכנולוגיה": "courses.faculties.education"
			}, value);
		}
		getFrameworkLabel(value) {
			if (isCatalogLanguage()) return value;
			return translated({
				"לימודי הסמכה": "courses.frameworks.undergraduate",
				"מקצוע משותף": "courses.frameworks.shared",
				"תארים מתקדמים": "courses.frameworks.graduate"
			}, value);
		}
		getLessonType(lesson) {
			if (lesson["סוג"] === "sadna") return "סדנה";
			return lesson["סוג"];
		}
		getLessonTypeAndNumber(lesson) {
			if (lesson["סוג"] === "sadna") return this.getLessonTypeLabel("sadna");
			return `${this.getLessonTypeLabel(lesson["סוג"])} ${lesson["מס."]}`;
		}
		parseExamDateTime(strDate) {
			let match = /^(\d+)-(\d+)-(\d+)(?:\s+(\d+)(:\d+)\s*-\s*(\d+)(:\d+))?/.exec(strDate);
			if (!match) match = /^בתאריך (\d+)\.(\d+)\.(\d+) (?:יום [א-ו] משעה (\d+)(:\d+)? עד השעה (\d+)(:\d+)?)?/.exec(strDate);
			if (!match) return null;
			const date = `${match[3]}-${match[2]}-${match[1]}`;
			let startHour = "00";
			if (match[4] !== void 0) startHour = `00${match[4]}`.slice(-2);
			let startMinute = "00";
			if (match[5] !== void 0) startMinute = `${match[5]}00`.slice(1, 3);
			const start = `${date}T${startHour}:${startMinute}:00`;
			let endHour = "00";
			if (match[6] !== void 0) endHour = `00${match[6]}`.slice(-2);
			let endMinute = "00";
			if (match[7] !== void 0) endMinute = `${match[7]}00`.slice(1, 3);
			return {
				start,
				end: `${date}T${endHour}:${endMinute}:00`
			};
		}
		parseLessonTime(strTime) {
			const match = /^(\d+)(:\d+)? - (\d+)(:\d+)?$/.exec(strTime);
			if (!match) return null;
			const startHour = `00${match[1]}`.slice(-2);
			let startMinute = "00";
			if (match[2] !== void 0) startMinute = `${match[2]}00`.slice(1, 3);
			const start = `${startHour}:${startMinute}`;
			const endHour = `00${match[3]}`.slice(-2);
			let endMinute = "00";
			if (match[4] !== void 0) endMinute = `${match[4]}00`.slice(1, 3);
			return {
				start,
				end: `${endHour}:${endMinute}`
			};
		}
		getDescription(course, options) {
			return getDescription(this, course, options);
		}
		filterCourses(filters) {
			return filterCourses(this, filters);
		}
	};
	function englishCatalogLabel(englishCatalog, map, value) {
		const labels = englishCatalog && englishCatalog[map];
		return labels && Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : value;
	}
	function isCatalogLanguage() {
		return CheeseI18n.getLocale() === "he";
	}
	exports.CourseManager = CourseManager;
	return exports;
})({});
