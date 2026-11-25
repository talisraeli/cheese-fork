"""Builds the English course catalog: the text that the Technion's SAP system has in English.

The site's catalog comes from technion-sap-info-fetcher, in Hebrew. SAP has English versions
of some of its text, which this script fetches for the semesters that the fetcher updates and
the site offers, into catalog-en/courses_<year>_<semester>.min.js:

    var courses_english = {
        "courses": {"02340114": {"name", "syllabus", "faculty", "level", "notes", "coordinators"}},
        "staff": {"<Hebrew name as in the catalog>": "<English name>"},
        "buildings": {"<Hebrew building as in the catalog>": "<English building>"}
    };

The site shows it in the English interface only, and falls back to the Hebrew text for whatever
is missing. Staff and building names are keyed by their Hebrew text in the catalog, so they're
matched by fetching the same data in both languages.

Only the standard library is used. Requests are sent one at a time, about 120 per semester.
"""

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "catalog-en"

BATCH_URL = (
    "https://portalex.technion.ac.il/sap/opu/odata/sap/Z_CM_EV_CDIR_DATA_SRV/$batch?sap-client=700"
)
LAST_SEMESTERS_URL = (
    "https://michael-maltsev.github.io/technion-sap-info-fetcher/last_semesters.json"
)

USER_AGENT = "CheeseFork2 English catalog (https://github.com/talisraeli/cheese-fork)"

COURSES_PAGE_SIZE = 100
SCHEDULES_PAGE_SIZE = 25
REQUEST_TIMEOUT = 120
REQUEST_DELAY = 1
RETRIES = 5

# Same as get_building_name in technion-sap-info-fetcher, which shortens the Hebrew building
# names in the catalog. The English names are keyed by the shortened Hebrew ones.
BUILDING_PREFIXES = {
    "בנין אולמן": "אולמן",
    "בנין בורוביץ הנדסה אזרחית": "בורוביץ הנדסה אזרחית",
    "בנין דן קהאן": "דן קהאן",
    "בנין הנ' אוירונאוטית": "הנ' אוירונאוטית",
    "בניין אמרסון": "אמרסון",
    "בנין זיסאפל": "זיסאפל",
    "בנין להנדסת חמרים": "הנדסת חמרים",
    "בנין ליידי דייוס": "ליידי דייוס",
    "בנין למדעי המחשב": "מדעי המחשב",
    "בנין ע'ש אמדו": "אמדו",
    "בנין עש אמדו": "אמדו",
    "בנין ע'ש טאוב": "טאוב",
    "בנין ע'ש סגו": "סגו",
    "בנין עש סגו": "סגו",
    "בנין פישבך": "פישבך",
    "בנין פקולטה לרפואה": "פקולטה לרפואה",
    "בניין ננו-אלקטרוניקה": "ננו-אלקטרוניקה",
    "בניין ספורט": "ספורט",
}

# SAP cuts English building names at this length.
SAP_TEXT_LIMIT = 40


def send_query(query: str, language: str) -> dict:
    """Sends an OData query in a $batch request, like the SAP course catalog site does."""
    boundary = "batch_cheesefork"
    body = "\r\n".join(
        [
            f"--{boundary}",
            "Content-Type: application/http",
            "Content-Transfer-Encoding: binary",
            "",
            f"GET {query} HTTP/1.1",
            "Accept: application/json",
            f"Accept-Language: {language}",
            "DataServiceVersion: 2.0",
            "MaxDataServiceVersion: 2.0",
            "",
            "",
            f"--{boundary}--",
            "",
        ]
    ).encode("utf-8")
    headers = {
        "Content-Type": f"multipart/mixed;boundary={boundary}",
        "Accept": "multipart/mixed",
        "Accept-Language": language,
        "DataServiceVersion": "2.0",
        "MaxDataServiceVersion": "2.0",
        "X-Requested-With": "X",
        "User-Agent": USER_AGENT,
    }

    delay = 5
    for attempt in range(RETRIES):
        time.sleep(REQUEST_DELAY)
        try:
            request = urllib.request.Request(BATCH_URL, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                text = response.read().decode("utf-8")
            match = re.search(r'\{"d":.*\}', text, re.DOTALL)
            if not match:
                raise RuntimeError(f"Unexpected response: {text[:300]}")
            return json.loads(match.group(0))["d"]
        except (urllib.error.URLError, RuntimeError, TimeoutError) as error:
            if attempt == RETRIES - 1:
                raise
            print(f"Retrying after {error}", flush=True)
            time.sleep(delay)
            delay *= 2
    raise AssertionError("unreachable")


def paged(path: str, params: dict, language: str, page_size: int):
    """Yields the results of a query, page by page."""
    skip = 0
    while True:
        page_params = dict(params, **{"$skip": str(skip), "$top": str(page_size)})
        results = send_query(f"{path}?{urllib.parse.urlencode(page_params)}", language)["results"]
        yield from results
        if len(results) < page_size:
            return
        skip += page_size


def semester_filter(year: int, semester: int) -> str:
    return f"Peryr eq '{year}' and Perid eq '{semester}'"


def clean_text(text) -> str:
    return re.sub(r"[ \t]+", " ", (text or "").strip())


def title_case_name(name: str) -> str:
    """SAP has English names in capitals, such as "YOSSI WEINSTEIN"."""

    def word(value: str) -> str:
        if not value.isupper() or len(value) < 2:
            return value
        return re.sub(
            r"[A-Z]+",
            lambda match: match.group(0)[0] + match.group(0)[1:].lower(),
            value,
        )

    return " ".join(word(part) for part in name.split(" "))


def person_name(person: dict, english: bool, skip_dash_title: bool) -> str:
    """A person as the catalog writes them: title, first name and last name."""
    title = person["Title"].strip()
    first = person["FirstName"].strip()
    last = person["LastName"].strip()
    if english:
        first, last = title_case_name(first), title_case_name(last)
    if skip_dash_title and (not title or title == "-"):
        return f"{first} {last}"
    return f"{title} {first} {last}"


def hebrew_building(building: str) -> str:
    building = re.sub(r"\s+", " ", building.strip())
    for prefix_from, prefix_to in BUILDING_PREFIXES.items():
        if building.startswith(prefix_from):
            return prefix_to + building[len(prefix_from):]
    return building


def english_building(building: str) -> str:
    """SAP cuts long names, such as "Siegfried and Irma Ullman Teaching Cente", so a cut word is dropped."""
    cut = len(building) >= SAP_TEXT_LIMIT  # Before trimming: cut names are padded to the limit.
    building = re.sub(r"\s+", " ", building.strip())
    if cut and " " in building:
        building = building.rsplit(" ", 1)[0]
        building = re.sub(r"(\s+(and|of|the|for)|[\s/,\-&]+)+$", "", building, flags=re.IGNORECASE)
    return building


HEBREW_LETTER = re.compile(r"[֐-׿]")

# Words kept in capitals when a course name written in capitals is converted.
ACRONYMS = {
    "AI", "AMD", "API", "AR", "BIM", "CAD", "CAM", "CMOS", "CPU", "CS", "DNA", "ECG", "EE", "EEG",
    "GIS", "GPS", "GPU", "HCI", "IC", "IE", "IP", "IT", "LED", "MEMS", "ML", "MRI", "NLP", "PCR",
    "RF", "RNA", "TMGM", "UAV", "VLSI", "VR",
}
SPECIAL_CASE = {"IOT": "IoT"}
SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "with"}
ROMAN_NUMERAL = re.compile(r"^(?=[IVX]+$)X{0,3}(IX|IV|V?I{0,3})$")


def english_text(text: str) -> str:
    """Where SAP has no English text, it returns the Hebrew one, which the site already has."""
    return "" if HEBREW_LETTER.search(text or "") else text


def course_name_case(name: str) -> str:
    """Some names are in capitals, such as "INT. TO ENGINEERING MECHANICS"; others are kept."""
    if not re.search(r"[A-Z]", name) or name != name.upper():
        return name

    def convert(word: str, first: bool) -> str:
        if word in SPECIAL_CASE:
            return SPECIAL_CASE[word]
        if word in ACRONYMS or ROMAN_NUMERAL.match(word) or re.search(r"\d", word):
            return word
        if not re.search(r"[AEIOUY]", word):
            return word  # Probably an abbreviation, such as "ST".
        lower = word.lower()
        if lower in SMALL_WORDS and not first:
            return lower
        return lower[0].upper() + lower[1:]

    # Words are separated by spaces and by "-", "/" and "(" within them.
    parts = re.split(r"([\s\-/(]+)", name)
    result = []
    first = True
    for part in parts:
        if re.fullmatch(r"[\s\-/(]+", part) or not part:
            result.append(part)
            continue
        match = re.match(r"^([A-Z]+)(.*)$", part)
        if match:
            result.append(convert(match.group(1), first) + match.group(2))
        else:
            result.append(part)
        first = False
    return "".join(result)


def clean_course(entry: dict) -> dict:
    """Keeps the English text only, and converts names written in capitals."""
    entry = {key: english_text(value) for key, value in entry.items()}
    if entry.get("name"):
        entry["name"] = course_name_case(entry["name"])
    return {key: value for key, value in entry.items() if value}


def clean(data: dict) -> dict:
    return {
        "courses": dict(sorted((course, entry) for course, entry in
                               ((course, clean_course(entry)) for course, entry in data["courses"].items()) if entry)),
        "staff": dict(sorted((key, value) for key, value in data["staff"].items() if english_text(value))),
        "buildings": dict(sorted((key, value) for key, value in data["buildings"].items() if english_text(value))),
    }


def fetch_courses(year: int, semester: int) -> dict:
    courses = {}
    params = {
        "sap-client": "700",
        "$filter": semester_filter(year, semester),
        "$select": ",".join(
            [
                "Otjid",
                "Name",
                "StudyContentDescription",
                "OrgText",
                "ZzAcademicLevelText",
                "ZzSemesterNote",
                "Responsible/Title",
                "Responsible/FirstName",
                "Responsible/LastName",
            ]
        ),
        "$expand": "Responsible",
    }
    for item in paged("SmObjectSet", params, "en", COURSES_PAGE_SIZE):
        course = item["Otjid"].removeprefix("SM")
        entry = {
            "name": re.sub(r"\s+", " ", (item["Name"] or "").strip()),
            "syllabus": clean_text(item["StudyContentDescription"]),
            "faculty": clean_text(item["OrgText"]),
            "level": clean_text(item["ZzAcademicLevelText"]),
            "notes": clean_text(item["ZzSemesterNote"]),
            "coordinators": "\n".join(
                person_name(person, True, False) for person in item["Responsible"]["results"]
            ),
        }
        courses[course] = {key: value for key, value in entry.items() if value}
    return courses


def fetch_people(year: int, semester: int, language: str) -> dict:
    """The lesson staff of every event, by course, group and event."""
    params = {
        "sap-client": "700",
        "$filter": semester_filter(year, semester),
        "$select": ",".join(
            [
                "Otjid",
                "SeObjectSet/ZzSeSeqnr",
                "SeObjectSet/EObjectSet/Otjid",
                "SeObjectSet/EObjectSet/Persons/Title",
                "SeObjectSet/EObjectSet/Persons/FirstName",
                "SeObjectSet/EObjectSet/Persons/LastName",
            ]
        ),
        "$expand": "SeObjectSet,SeObjectSet/EObjectSet,SeObjectSet/EObjectSet/Persons",
    }
    people = {}
    for course in paged("SmObjectSet", params, language, SCHEDULES_PAGE_SIZE):
        for group in (course.get("SeObjectSet") or {}).get("results", []):
            for event in group["EObjectSet"]["results"]:
                key = (course["Otjid"], group["ZzSeSeqnr"], event["Otjid"])
                people[key] = [
                    person_name(person, language == "en", True)
                    for person in event["Persons"]["results"]
                ]
    return people


def fetch_staff(year: int, semester: int) -> dict:
    hebrew = fetch_people(year, semester, "he")
    english = fetch_people(year, semester, "en")
    staff = {}
    for key, hebrew_names in hebrew.items():
        english_names = english.get(key, [])
        if len(english_names) != len(hebrew_names):
            continue
        for hebrew_name, english_name in zip(hebrew_names, english_names):
            if hebrew_name != english_name:
                staff.setdefault(hebrew_name, english_name)
    return staff


def fetch_rooms(year: int, semester: int, language: str) -> dict:
    params = {
        "sap-client": "700",
        "$filter": semester_filter(year, semester),
        "$select": "Otjid,Building",
    }
    return {room["Otjid"]: room["Building"] for room in paged("GObjectSet", params, language, 2000)}


def fetch_buildings(year: int, semester: int) -> dict:
    hebrew = fetch_rooms(year, semester, "he")
    english = fetch_rooms(year, semester, "en")
    buildings = {}
    for room, building in hebrew.items():
        if building and english.get(room):
            buildings.setdefault(hebrew_building(building), english_building(english[room]))
    return buildings


def offered_semesters() -> list:
    """The semesters both the fetcher updates and index.html offers, as (year, SAP semester)."""
    request = urllib.request.Request(LAST_SEMESTERS_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        last_semesters = json.load(response)

    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    match = re.search(r"\bvar availableSemesters = ([^;]*);\n", index_html)
    available = [key for key in json.loads(match.group(1)) if not key.endswith("_")]

    result = []
    for item in last_semesters:
        semester = str(item["year"]) + str(item["semester"] - 200 + 1).zfill(2)
        if semester in available:
            result.append((item["year"], item["semester"]))
    return result


def build(year: int, semester: int) -> dict:
    print(f"{year}/{semester}: courses", flush=True)
    courses = fetch_courses(year, semester)
    print(f"{year}/{semester}: staff", flush=True)
    staff = fetch_staff(year, semester)
    print(f"{year}/{semester}: buildings", flush=True)
    buildings = fetch_buildings(year, semester)
    print(f"{year}/{semester}: {len(courses)} courses, {len(staff)} staff, {len(buildings)} buildings", flush=True)
    return clean({"courses": courses, "staff": staff, "buildings": buildings})


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    semesters = [(int(year), int(semester)) for year, semester in (arg.split("/") for arg in sys.argv[1:])]
    for year, semester in semesters or offered_semesters():
        data = build(year, semester)
        content = "var courses_english = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
        path = OUTPUT_DIR / f"courses_{year}_{semester}.min.js"
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            path.write_text(content, encoding="utf-8")
            print(f"Wrote {path.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
