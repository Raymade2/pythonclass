/**
 * Demo data seeder — Sure Foundation School Fee Management System.
 * Run with: npm run db:seed   (resets and repopulates the database)
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import path from "path";
import bcrypt from "bcryptjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = process.env.SQLITE_PATH
  ? path.isAbsolute(process.env.SQLITE_PATH) ? process.env.SQLITE_PATH : path.join(ROOT, process.env.SQLITE_PATH)
  : path.join(DATA_DIR, "sfgs.db");

// --- Extract DDL from lib/ddl.ts (single source of truth) -------------------
const ddlSource = readFileSync(path.join(ROOT, "lib", "ddl.ts"), "utf8");
const DDL = ddlSource.match(/`([\s\S]*)`/)[1];

mkdirSync(path.dirname(DB_PATH), { recursive: true });
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  if (existsSync(DB_PATH + suffix)) rmSync(DB_PATH + suffix);
}
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(DDL);

// --- Seeded RNG for reproducible demo data ----------------------------------
let seed = 20260928;
function rng() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const chance = (p) => rng() < p;
const randInt = (a, b) => a + Math.floor(rng() * (b - a + 1));

function run(sql, params = []) {
  db.prepare(sql).run(...params.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v)));
}
function insert(sql, params) {
  run(sql, params);
  return Number(db.prepare("SELECT last_insert_rowid() AS id").get().id);
}

// --- Names -------------------------------------------------------------------
const MALE = ["Chinedu","Oluwaseun","Ibrahim","Emeka","Adebayo","Musa","Chukwuemeka","Tunde","Kelechi","Obinna","Yusuf","Segun","Uche","Damilare","Ekene","Ifeanyi","Babatunde","Nnamdi","Abubakar","Femi","Olumide","Efe","Tochukwu","Samuel","David","Michael","Promise","Divine","Chisom","Victor","Chidera","Ade","Kene","Somto","Hassan","Emmanuel","Gabriel","Henry","Ikechukwu","Jide"];
const FEMALE = ["Chioma","Amina","Funmilayo","Ngozi","Adaeze","Blessing","Halima","Yemisi","Chiamaka","Oluchi","Fatima","Temitope","Zainab","Amarachi","Ifeoma","Bukola","Grace","Joy","Peace","Precious","Ujunwa","Simisola","Aisha","Ejiro","Ogechi","Nneka","Ronke","Titilayo","Amaka","Ezinne","Kamsiyochukwu","Daniella","Zara","Muna","Tari","Onome","Anita","Esther","Mercy","Deborah"];
const SURNAMES = ["Okafor","Adeyemi","Bello","Okonkwo","Eze","Balogun","Mohammed","Ogunleye","Nwosu","Afolabi","Ibrahim","Umeh","Adewale","Okeke","Suleiman","Ogundipe","Nnamani","Ajayi","Danjuma","Chukwu","Abiodun","Okoro","Lawal","Obi","Adekunle","Onyeka","Ossai","Igwe","Adebisi","Olaniyan","Achike","Momoh","Erinle","Dosunmu","Chidiebere","Bassey","Udoh","Adamu","Oliseh","Popoola"];
const TITLES = ["Mr.","Mrs.","Ms.","Dr.","Alhaji","Chief","Pastor","Engineer","Lady"];
const QUALIFICATIONS = ["B.Ed (UNN)","NCE (FCE Zaria)","B.Sc Ed (UI)","M.Ed (UNILAG)","B.A Ed (OAU)","PGDE (NOUN)","B.Ed (ABSU)","M.Sc Ed (UNICAL)"];
const SUBJECTS = ["Mathematics","English Language","Basic Science","Social Studies","Civic Education","Computer Studies","Agricultural Science","Business Studies","Christian Religious Studies","Basic Technology","Yoruba","Igbo","French","Physical & Health Education","Home Economics","Fine Arts","Physics","Chemistry","Biology","Further Mathematics","Economics","Government","Literature-in-English","Geography"];

console.log("Seeding demo data…");

// --- School ------------------------------------------------------------------
run(`INSERT INTO school (id, name, short_name, address, phone, email, motto) VALUES (1, ?, 'SFGS', ?, ?, ?, ?)`, [
  "Sure Foundation Group of Schools",
  "Plot 14, Foundation Avenue, off Salvation Road, Oke-Ira, Ikeja, Lagos State, Nigeria",
  "+234 803 456 7890",
  "info@surefoundationschools.edu.ng",
  "Knowledge · Character · Excellence",
]);

// --- Sessions & terms --------------------------------------------------------
const SESSIONS = [
  { name: "2024/2025", start: "2024-09-09", end: "2025-07-25", current: 0 },
  { name: "2025/2026", start: "2025-09-08", end: "2026-07-24", current: 0 },
  { name: "2026/2027", start: "2026-09-14", end: "2027-07-23", current: 1 },
];
const TERM_DATES = (year) => ({
  "First Term": { start: `${year}-09-14`, end: `${year}-12-11` },
  "Second Term": { start: `${Number(year) + 1}-01-11`, end: `${Number(year) + 1}-04-03` },
  "Third Term": { start: `${Number(year) + 1}-04-26`, end: `${Number(year) + 1}-07-23` },
});
const sessionIds = {};
const termIds = {}; // termIds[sessionName][termName] = id
for (const s of SESSIONS) {
  const id = insert(`INSERT INTO academic_sessions (name, start_date, end_date, is_current, status) VALUES (?, ?, ?, ?, 'ACTIVE')`, [s.name, s.start, s.end, s.current]);
  sessionIds[s.name] = id;
  termIds[s.name] = {};
  const year = s.name.split("/")[0];
  const dates = TERM_DATES(year);
  for (const t of ["First Term", "Second Term", "Third Term"]) {
    const d = dates[t];
    const isCurrent = s.current && t === "First Term" ? 1 : 0;
    termIds[s.name][t] = insert(`INSERT INTO terms (name, session_id, start_date, end_date, is_current, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')`, [t, id, d.start, d.end, isCurrent]);
  }
}
const CUR_SESSION = "2026/2027";
const CUR_TERM = "First Term";

// --- Class groups -------------------------------------------------------------
const groups = {};
for (const [name, desc] of [
  ["Early Years", "Creche and Nursery — early childhood foundation (ages 1–5)"],
  ["Primary", "Primary 1 – 6 — basic education (ages 5–11)"],
  ["Secondary", "JSS 1 – SS 3 — junior and senior secondary education"],
]) {
  groups[name] = insert(`INSERT INTO class_groups (name, description, status) VALUES (?, ?, 'ACTIVE')`, [name, desc]);
}

// --- Teachers -----------------------------------------------------------------
const teacherNames = [
  ["Chinedu","Obiano"],["Adaeze","Nwankwo"],["Yusuf","Abdullahi"],["Funmilayo","Adeoya"],["Emeka","Nwachukwu"],
  ["Halima","Sanni"],["Olusegun","Bamigbade"],["Ifeoma","Ezeani"],["Tunde","Salami"],["Blessing","Oghenekaro"],
  ["Ibrahim","Danladi"],["Chiamaka","Ihedioha"],["Femi","Oladipo"],["Ngozi","Ubadike"],["Kelechi","Amadi"],
  ["Zainab","Yusuf"],["Obinna","Okoroafor"],["Titilayo","Bakare"],["Samuel","Effiong"],["Amina","Bello"],
  ["Olumide","Fafunwa"],["Ejiro","Akpojaro"],["Chukwuemeka","Osuagwu"],["Ronke","Adekoya"],
];
const teachers = [];
teacherNames.forEach(([first, last], i) => {
  const gender = ["Ifeoma","Blessing","Amina","Zainab","Halima","Chiamaka","Ngozi","Titilayo","Ejiro","Ronke","Adaeze","Funmilayo"].includes(first) ? "Female" : "Male";
  const id = insert(
    `INSERT INTO teachers (teacher_code, first_name, last_name, gender, phone, email, address, qualification, specialization, date_employed, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [`TCH-${String(i + 1).padStart(4, "0")}`, first, last, gender,
     `+234 8${randInt(10, 19)} ${randInt(200, 999)} ${randInt(1000, 9999)}`,
     `${first.toLowerCase()}.${last.toLowerCase()}@surefoundationschools.edu.ng`,
     `${randInt(1, 80)} ${pick(["Adeola","Ojoo","Foundation","Salvation","Ogba","Agege"])} ${pick(["Str.","Ave.","Rd.","Close"])}, Ikeja, Lagos`,
     pick(QUALIFICATIONS), pick(SUBJECTS),
     `20${randInt(18, 25)}-0${randInt(1, 9)}-1${randInt(0, 9)}`]
  );
  teachers.push({ id, first, last });
});

// --- Classes -------------------------------------------------------------------
const CLASS_DEFS = [
  ["Creche", "CRE", "Early Years", 20],
  ["Nursery 1", "NUR-1", "Early Years", 24], ["Nursery 2", "NUR-2", "Early Years", 24], ["Nursery 3", "NUR-3", "Early Years", 24],
  ["Primary 1", "PRI-1", "Primary", 30], ["Primary 2", "PRI-2", "Primary", 30], ["Primary 3", "PRI-3", "Primary", 30],
  ["Primary 4", "PRI-4", "Primary", 30], ["Primary 5", "PRI-5", "Primary", 30], ["Primary 6", "PRI-6", "Primary", 30],
  ["JSS 1", "JSS-1", "Secondary", 32], ["JSS 2", "JSS-2", "Secondary", 32], ["JSS 3", "JSS-3", "Secondary", 32],
  ["SS 1", "SS-1", "Secondary", 30], ["SS 2", "SS-2", "Secondary", 30], ["SS 3", "SS-3", "Secondary", 30],
];
const classes = {};
CLASS_DEFS.forEach(([name, code, groupName, capacity], i) => {
  const classTeacher = teachers[i % teachers.length];
  const id = insert(
    `INSERT INTO classes (name, code, section, class_group_id, session_id, class_teacher_id, capacity, status)
     VALUES (?, ?, 'A', ?, ?, ?, ?, 'ACTIVE')`,
    [name, code, groups[groupName], sessionIds[CUR_SESSION], classTeacher.id, capacity]
  );
  classes[name] = { id, code, group: groupName, teacher: classTeacher };
});

// Teacher-class assignments (current session, first term)
for (const [name, c] of Object.entries(classes)) {
  insert(`INSERT INTO teacher_class_assignments (teacher_id, class_id, session_id, term_id, role, subject) VALUES (?, ?, ?, ?, 'CLASS_TEACHER', NULL)`,
    [c.teacher.id, c.id, sessionIds[CUR_SESSION], termIds[CUR_SESSION][CUR_TERM]]);
}
// extra subject teachers
const subjectAssignments = [
  ["Primary 5", "Mathematics"],["Primary 5", "Basic Science"],["Primary 6", "English Language"],["Primary 6", "Computer Studies"],
  ["JSS 1", "Mathematics"],["JSS 1", "Basic Science"],["JSS 2", "Social Studies"],["JSS 3", "Business Studies"],
  ["SS 1", "Physics"],["SS 1", "Chemistry"],["SS 2", "Biology"],["SS 2", "Economics"],["SS 3", "Further Mathematics"],["SS 3", "Literature-in-English"],
];
for (const [cls, subject] of subjectAssignments) {
  const t = pick(teachers.filter((t) => t.id !== classes[cls].teacher.id));
  insert(`INSERT INTO teacher_class_assignments (teacher_id, class_id, session_id, term_id, role, subject) VALUES (?, ?, ?, ?, 'SUBJECT_TEACHER', ?)`,
    [t.id, classes[cls].id, sessionIds[CUR_SESSION], termIds[CUR_SESSION][CUR_TERM], subject]);
}

// --- Fee categories -------------------------------------------------------------
const FEE_CATS = {
  "Tuition Fee": "Core academic tuition per term",
  "Development Levy": "School infrastructure and development",
  "ICT Fee": "Computer laboratory and digital learning",
  "Examination Fee": "Terminal examinations",
  "Library Fee": "Library services and materials",
};
const feeCatIds = {};
for (const [name, desc] of Object.entries(FEE_CATS)) {
  feeCatIds[name] = insert(`INSERT INTO fee_categories (name, description) VALUES (?, ?)`, [name, desc]);
}

// --- Fees per class/session/term ------------------------------------------------
// Base First Term tuition & levies per class
const FEE_PLAN = {
  "Creche":     { "Tuition Fee": 60000, "Development Levy": 10000 },
  "Nursery 1":  { "Tuition Fee": 70000, "Development Levy": 10000, "Examination Fee": 3000 },
  "Nursery 2":  { "Tuition Fee": 75000, "Development Levy": 10000, "Examination Fee": 3000 },
  "Nursery 3":  { "Tuition Fee": 80000, "Development Levy": 10000, "Examination Fee": 3000, "Library Fee": 2000 },
  "Primary 1":  { "Tuition Fee": 95000, "Development Levy": 15000, "ICT Fee": 8000, "Examination Fee": 4000, "Library Fee": 3000 },
  "Primary 2":  { "Tuition Fee": 100000, "Development Levy": 15000, "ICT Fee": 8000, "Examination Fee": 4000, "Library Fee": 3000 },
  "Primary 3":  { "Tuition Fee": 105000, "Development Levy": 15000, "ICT Fee": 8000, "Examination Fee": 4000, "Library Fee": 3000 },
  "Primary 4":  { "Tuition Fee": 110000, "Development Levy": 15000, "ICT Fee": 10000, "Examination Fee": 5000, "Library Fee": 3000 },
  "Primary 5":  { "Tuition Fee": 115000, "Development Levy": 15000, "ICT Fee": 10000, "Examination Fee": 5000, "Library Fee": 3000 },
  "Primary 6":  { "Tuition Fee": 120000, "Development Levy": 15000, "ICT Fee": 10000, "Examination Fee": 5000, "Library Fee": 3000 },
  "JSS 1":      { "Tuition Fee": 140000, "Development Levy": 20000, "ICT Fee": 12000, "Examination Fee": 6000, "Library Fee": 5000 },
  "JSS 2":      { "Tuition Fee": 145000, "Development Levy": 20000, "ICT Fee": 12000, "Examination Fee": 6000, "Library Fee": 5000 },
  "JSS 3":      { "Tuition Fee": 150000, "Development Levy": 20000, "ICT Fee": 12000, "Examination Fee": 6000, "Library Fee": 5000 },
  "SS 1":       { "Tuition Fee": 170000, "Development Levy": 20000, "ICT Fee": 15000, "Examination Fee": 6000, "Library Fee": 5000 },
  "SS 2":       { "Tuition Fee": 175000, "Development Levy": 20000, "ICT Fee": 15000, "Examination Fee": 6000, "Library Fee": 5000 },
  "SS 3":       { "Tuition Fee": 180000, "Development Levy": 20000, "ICT Fee": 15000, "Examination Fee": 6000, "Library Fee": 5000 },
};
const TERM_MULTIPLIER = { "First Term": 1, "Second Term": 0.9, "Third Term": 0.85 };
const TERM_DUE = (year, term) =>
  term === "First Term" ? `${year}-09-30` : term === "Second Term" ? `${Number(year) + 1}-01-31` : `${Number(year) + 1}-05-15`;
// A few classes have earlier due dates (drives the "overdue" demo data)
const EARLY_DUE_CLASSES = new Set(["Nursery 3", "Primary 4", "Primary 6", "JSS 2", "SS 2"]);

function roundTo500(n) { return Math.round(n / 500) * 500; }

for (const sessionName of ["2025/2026", "2026/2027"]) {
  const year = sessionName.split("/")[0];
  for (const termName of ["First Term", "Second Term", "Third Term"]) {
    for (const [clsName, plan] of Object.entries(FEE_PLAN)) {
      const mult = TERM_MULTIPLIER[termName];
      const dueDate = EARLY_DUE_CLASSES.has(clsName)
        ? termName === "First Term" ? `${year}-09-15` : TERM_DUE(year, termName)
        : TERM_DUE(year, termName);
      for (const [cat, baseAmt] of Object.entries(plan)) {
        const amount = cat === "Tuition Fee" ? roundTo500(baseAmt * mult) : baseAmt;
        insert(
          `INSERT INTO fees (name, category_id, amount, class_id, session_id, term_id, due_date, description, mandatory, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE')`,
          [cat, feeCatIds[cat], amount, classes[clsName].id, sessionIds[sessionName], termIds[sessionName][termName],
           dueDate, `${cat} for ${clsName} — ${termName}, ${sessionName}`]
        );
      }
    }
  }
}

// --- Other payments (current session, first term) ---------------------------------
const sid = sessionIds[CUR_SESSION];
const tid = termIds[CUR_SESSION][CUR_TERM];
const otherPaymentDefs = [
  { name: "PTA Levy", category: "PTA levy", amount: 5000, scope: "SCHOOL", mandatory: true, due: "2026-09-30", desc: "Parents-Teachers Association annual levy" },
  { name: "School Uniform (2 sets)", category: "Uniform", amount: 15000, scope: "SCHOOL", mandatory: false, due: "2026-10-15", desc: "Official school uniform" },
  { name: "Sports Fee", category: "Sports", amount: 3000, scope: "SCHOOL", mandatory: false, due: "2026-11-06", desc: "Inter-house sports" },
  { name: "Excursion (Educational Tour)", category: "Excursion", amount: 10000, scope: "GROUP", group: "Primary", mandatory: false, due: "2026-11-20", desc: "Termly educational excursion" },
  { name: "WAEC Registration Fee", category: "WAEC", amount: 35000, scope: "CLASS", cls: "SS 3", mandatory: true, due: "2026-11-30", desc: "WAEC SSCE registration" },
  { name: "NECO Registration Fee", category: "NECO", amount: 25000, scope: "CLASS", cls: "SS 3", mandatory: true, due: "2026-12-05", desc: "NECO SSCE registration" },
  { name: "BECE Registration Fee", category: "BECE", amount: 20000, scope: "CLASS", cls: "JSS 3", mandatory: true, due: "2026-12-05", desc: "Basic Education Certificate Examination" },
  { name: "Graduation Fee", category: "Graduation", amount: 20000, scope: "CLASS", cls: "SS 3", mandatory: false, due: "2027-06-15", desc: "Graduation ceremony" },
  { name: "Graduation Fee", category: "Graduation", amount: 15000, scope: "CLASS", cls: "Primary 6", mandatory: false, due: "2027-06-15", desc: "Valedictory service & graduation" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 12000, scope: "CLASS", cls: "Primary 1", mandatory: true, due: "2026-09-30", desc: "Complete set of termly textbooks" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 12000, scope: "CLASS", cls: "Primary 2", mandatory: true, due: "2026-09-30", desc: "Complete set of termly textbooks" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 13000, scope: "CLASS", cls: "Primary 3", mandatory: true, due: "2026-09-30", desc: "Complete set of termly textbooks" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 14000, scope: "CLASS", cls: "Primary 4", mandatory: true, due: "2026-09-30", desc: "Complete set of termly textbooks" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 14000, scope: "CLASS", cls: "Primary 5", mandatory: true, due: "2026-09-30", desc: "Complete set of termly textbooks" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 15000, scope: "CLASS", cls: "Primary 6", mandatory: true, due: "2026-09-30", desc: "Complete set of termly textbooks" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 8000, scope: "CLASS", cls: "Nursery 1", mandatory: true, due: "2026-09-30", desc: "Early years learning materials" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 8000, scope: "CLASS", cls: "Nursery 2", mandatory: true, due: "2026-09-30", desc: "Early years learning materials" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 9000, scope: "CLASS", cls: "Nursery 3", mandatory: true, due: "2026-09-30", desc: "Early years learning materials" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 18000, scope: "CLASS", cls: "JSS 1", mandatory: true, due: "2026-09-30", desc: "Junior secondary textbook set" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 18000, scope: "CLASS", cls: "JSS 2", mandatory: true, due: "2026-09-30", desc: "Junior secondary textbook set" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 20000, scope: "CLASS", cls: "JSS 3", mandatory: true, due: "2026-09-30", desc: "Junior secondary textbook set" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 22000, scope: "CLASS", cls: "SS 1", mandatory: true, due: "2026-09-30", desc: "Senior secondary textbook set" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 22000, scope: "CLASS", cls: "SS 2", mandatory: true, due: "2026-09-30", desc: "Senior secondary textbook set" },
  { name: "Textbooks & Workbooks", category: "Textbooks", amount: 25000, scope: "CLASS", cls: "SS 3", mandatory: true, due: "2026-09-30", desc: "Senior secondary textbook set" },
];
for (const d of otherPaymentDefs) {
  insert(
    `INSERT INTO other_payments (name, category, amount, scope, student_id, class_id, class_group_id, session_id, term_id, due_date, description, mandatory, status)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [d.name, d.category, d.amount, d.scope,
     d.cls ? classes[d.cls].id : null,
     d.group ? groups[d.group] : null,
     sid, tid, d.due, d.desc, d.mandatory]
  );
}

// --- Students & parents -------------------------------------------------------------
const CLASS_SIZES = {
  "Creche": 4, "Nursery 1": 6, "Nursery 2": 6, "Nursery 3": 7,
  "Primary 1": 8, "Primary 2": 8, "Primary 3": 8, "Primary 4": 8, "Primary 5": 9, "Primary 6": 8,
  "JSS 1": 8, "JSS 2": 8, "JSS 3": 7, "SS 1": 7, "SS 2": 6, "SS 3": 6,
}; // = 114 students

// Rough age per class for realistic DOBs
const CLASS_AGE = { "Creche": 2, "Nursery 1": 3, "Nursery 2": 4, "Nursery 3": 5, "Primary 1": 6, "Primary 2": 7, "Primary 3": 8, "Primary 4": 9, "Primary 5": 10, "Primary 6": 11, "JSS 1": 12, "JSS 2": 13, "JSS 3": 14, "SS 1": 15, "SS 2": 16, "SS 3": 17 };

const students = [];
let studentSeq = 0;
const usedNames = new Set();

function uniqueStudentName() {
  for (let i = 0; i < 500; i++) {
    const first = chance(0.5) ? pick(MALE) : pick(FEMALE);
    const last = pick(SURNAMES);
    const key = `${first} ${last}`;
    if (!usedNames.has(key)) { usedNames.add(key); return [first, last]; }
  }
  return [pick(MALE), pick(SURNAMES)];
}

const parents = [];
function makeParent(childLast) {
  const name = `${pick(TITLES)} ${pick(MALE.concat(FEMALE))} ${childLast}`;
  const id = insert(
    `INSERT INTO parents (name, relationship, phone, email, address, occupation) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, chance(0.55) ? "Father" : chance(0.8) ? "Mother" : "Guardian",
     `+234 8${randInt(10, 19)} ${randInt(200, 999)} ${randInt(1000, 9999)}`,
     chance(0.7) ? `${name.split(" ")[1].toLowerCase()}.${childLast.toLowerCase()}@gmail.com` : null,
     `${randInt(1, 80)} ${pick(["Foundation","Adeola","Ojoo","Ogba","Salvation","Agidingbi"])} ${pick(["Str.","Ave.","Rd.","Close"])}, Ikeja, Lagos`,
     pick(["Trader","Civil Servant","Engineer","Teacher","Banker","Business Owner","Nurse","Lawyer","Tailor","Driver","Accountant","Pharmacist"])]
  );
  parents.push({ id, name, phone: "" });
  return id;
}

for (const [clsName, size] of Object.entries(CLASS_SIZES)) {
  for (let i = 0; i < size; i++) {
    studentSeq++;
    const [first, last] = uniqueStudentName();
    const middle = chance(0.45) ? pick(chance(0.5) ? MALE : FEMALE) : null;
    const gender = MALE.includes(first) ? "Male" : "Female";
    const age = CLASS_AGE[clsName] + randInt(0, 1);
    const dob = new Date(2026 - age, randInt(0, 11), randInt(1, 28));
    // ~10% of students are from shared families (2 children same parent)
    const parentId = parents.length > 5 && chance(0.12) ? pick(parents.slice(-10)).id : makeParent(last);
    const isNew = chance(0.35); // admitted this session
    const admissionDate = isNew
      ? new Date(2026, randInt(6, 8), randInt(1, 28))
      : new Date(2026 - randInt(1, 4), randInt(0, 8), randInt(1, 28));
    const status = chance(0.94) ? "ACTIVE" : chance(0.5) ? "INACTIVE" : "TRANSFERRED";

    const id = insert(
      `INSERT INTO students (student_code, admission_number, first_name, middle_name, last_name, gender, date_of_birth, phone, email, address, parent_id, admission_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      [`SFGS/2026/${String(studentSeq).padStart(5, "0")}`, `SFGS/ADM/2026/${String(studentSeq).padStart(5, "0")}`,
       first, middle, last, gender, dob.toISOString().slice(0, 10),
       chance(0.15) ? `${first.toLowerCase()}.${last.toLowerCase()}@gmail.com` : null,
       `${randInt(1, 80)} ${pick(["Foundation","Adeola","Ojoo","Ogba"])} ${pick(["Str.","Ave.","Rd."])}, Ikeja, Lagos`,
       parentId, admissionDate.toISOString().slice(0, 10), status]
    );
    students.push({ id, first, middle, last, clsName, status, parentId });

    if (status === "ACTIVE") {
      // Current session / term assignment
      insert(`INSERT INTO student_class_assignments (student_id, class_id, session_id, term_id, assigned_by_name) VALUES (?, ?, ?, ?, 'Mrs. Grace Obi')`,
        [id, classes[clsName].id, sid, tid]);
      // History: previous session third term
      insert(`INSERT INTO student_class_assignments (student_id, class_id, session_id, term_id, assigned_by_name) VALUES (?, ?, ?, ?, 'Mrs. Grace Obi')`,
        [id, classes[clsName].id, sessionIds["2025/2026"], termIds["2025/2026"]["Third Term"]]);
    }
  }
}

// --- Users ---------------------------------------------------------------------------
const hash = (pw) => bcrypt.hashSync(pw, 10);
const usersToCreate = [
  { name: "Mrs. Grace Obi", email: "superadmin@sfgs.edu.ng", username: "superadmin", password: "Admin@123", role: "SUPER_ADMIN", teacherId: null, parentId: null },
  { name: "Mr. Daniel Eze", email: "admin@sfgs.edu.ng", username: "admin", password: "Admin@123", role: "ADMIN", teacherId: null, parentId: null },
];
const adminIds = [];
for (const u of usersToCreate) {
  const id = insert(`INSERT INTO users (name, email, phone, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [u.name, u.email, "+234 803 456 7890", u.username, hash(u.password), u.role]);
  adminIds.push(id);
}
// Teacher account: class teacher of Primary 5
const p5Teacher = classes["Primary 5"].teacher;
const teacherUserId = insert(
  `INSERT INTO users (name, email, phone, username, password_hash, role, status, teacher_id) VALUES (?, ?, ?, ?, ?, 'TEACHER', 'ACTIVE', ?)`,
  [`${p5Teacher.first} ${p5Teacher.last}`, "teacher@sfgs.edu.ng", "+234 803 456 7890", "teacher", hash("Teacher@123"), p5Teacher.id]
);
// Parent account: parent of first two Primary 5 students
const p5Students = students.filter((s) => s.clsName === "Primary 5" && s.status === "ACTIVE").slice(0, 2);
const demoParentId = p5Students[0].parentId;
if (p5Students[1] && p5Students[1].parentId !== demoParentId) {
  run(`UPDATE students SET parent_id = ? WHERE id = ?`, [demoParentId, p5Students[1].id]);
}
const parentUser = insert(
  `INSERT INTO users (name, email, phone, username, password_hash, role, status, parent_id) VALUES (?, ?, ?, ?, ?, 'PARENT', 'ACTIVE', ?)`,
  ["Mr. & Mrs. " + p5Students[0].last, "parent@sfgs.edu.ng", "+234 803 456 7891", "parent", hash("Parent@123"), demoParentId]
);

// --- Invoices, items & payments --------------------------------------------------------
let invoiceSeq2026 = 0, invoiceSeq2025 = 0;
let receiptSeq = 0, paySeq = 0;
const TODAY = new Date();
const money = (n) => `₦${n.toLocaleString("en-NG")}`;

function addInvoice({ student, sessionName, termName, items, dueDate, createdBy, historical }) {
  const sessionId = sessionIds[sessionName];
  const termId = termIds[sessionName][termName];
  const year = sessionName.split("/")[0];
  const seq = year === "2026" ? ++invoiceSeq2026 : ++invoiceSeq2025;
  const invoiceNumber = `SFGS-${year}-${String(seq).padStart(6, "0")}`;
  const total = items.reduce((s, i) => s + i.amount, 0);
  const due = new Date(dueDate);
  const overdue = due < TODAY && total > 0;
  const id = insert(
    `INSERT INTO invoices (invoice_number, student_id, session_id, term_id, total_amount, amount_paid, balance, due_date, status, notes, generated_by_user_id, generated_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'UNPAID', NULL, ?, ?, ?)`,
    [invoiceNumber, student.id, sessionId, termId, total, total, dueDate, adminIds[1], createdBy, historical ? dueDate : `${new Date(2026, 8, randInt(1, 25)).toISOString().slice(0, 11)}0:00:00.000Z`]
  );
  for (const it of items) {
    insert(`INSERT INTO invoice_items (invoice_id, description, amount, quantity, fee_id, other_payment_id) VALUES (?, ?, ?, 1, ?, ?)`,
      [id, it.description, it.amount, it.feeId ?? null, it.otherPaymentId ?? null]);
  }
  return { id, invoiceNumber, total, dueDate };
}

function addPayment({ invoiceId, studentId, amount, method, channel, date, txRef }) {
  paySeq++; receiptSeq++;
  const reference = `PAY-2026-${String(paySeq).padStart(6, "0")}`;
  const receiptNumber = `RCP-2026-${String(receiptSeq).padStart(5, "0")}`;
  const id = insert(
    `INSERT INTO payments (reference, receipt_number, invoice_id, student_id, amount, method, channel, transaction_reference, payment_date, recorded_by_user_id, recorded_by_name, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'SUCCESSFUL')`,
    [reference, receiptNumber, invoiceId, studentId, amount, method, channel ?? null, txRef ?? null,
     date.toISOString(), adminIds[1], "Mr. Daniel Eze"]
  );
  return { id, receiptNumber };
}

function settleInvoice(inv, student, paymentsPlan, baseDate) {
  let paid = 0;
  let dayOffset = 0;
  for (const [fraction, method, channel] of paymentsPlan) {
    const amount = Math.round(inv.total * fraction);
    if (amount <= 0) continue;
    const date = new Date(baseDate.getTime() + dayOffset * 86400000);
    if (date > TODAY) continue;
    addPayment({ invoiceId: inv.id, studentId: student.id, amount, method, channel, date, txRef: channel ? `SFGS-TX-DEMO-${paySeq}` : null });
    paid += amount;
    dayOffset += randInt(3, 12);
  }
  run(`UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?`,
    [paid, Math.max(inv.total - paid, 0),
     paid <= 0 ? (new Date(inv.dueDate) < TODAY ? "OVERDUE" : "UNPAID")
     : paid >= inv.total ? "FULLY_PAID"
     : new Date(inv.dueDate) < TODAY ? "OVERDUE" : "PARTIALLY_PAID",
     inv.id]);
  return paid;
}

// Current term invoices for every active student
const classOtherPayments = {}; // clsName -> other payment rows
for (const d of otherPaymentDefs) {
  if (d.cls) { (classOtherPayments[d.cls] ??= []).push(d); }
}
const schoolScopeOthers = otherPaymentDefs.filter((d) => d.scope === "SCHOOL");
const groupScopeOthers = otherPaymentDefs.filter((d) => d.scope === "GROUP");

let collectedCurrent = 0, count = 0;
for (const student of students.filter((s) => s.status === "ACTIVE")) {
  const fees = Object.entries(FEE_PLAN[student.clsName]).map(([cat]) => ({ cat }));
  const feeRows = db.prepare(
    `SELECT f.id, f.name, f.amount, f.due_date, fc.name AS cat FROM fees f JOIN fee_categories fc ON fc.id = f.category_id
     WHERE f.class_id = ? AND f.session_id = ? AND f.term_id = ? AND f.status = 'ACTIVE'`
  ).all(classes[student.clsName].id, sid, tid);
  const items = feeRows.map((f) => ({ description: `${f.name} — ${f.cat}`, amount: f.amount, feeId: f.id }));
  let due = "2026-09-30";
  const early = feeRows.find((f) => f.due_date === "2026-09-15");
  if (early) due = "2026-09-15";

  // add other payments
  const addOther = (d) => {
    const row = db.prepare(`SELECT id FROM other_payments WHERE name = ? AND category = ? AND session_id = ? AND term_id = ?`).get(d.name, d.category, sid, tid);
    if (row) items.push({ description: `${d.name} — ${d.category}`, amount: d.amount, otherPaymentId: row.id });
  };
  for (const d of schoolScopeOthers) if (d.mandatory || chance(0.5)) addOther(d);
  for (const d of groupScopeOthers) if (classes[student.clsName].group === d.group && chance(0.4)) addOther(d);
  for (const d of classOtherPayments[student.clsName] ?? []) if (d.mandatory || chance(0.3)) addOther(d);

  const inv = addInvoice({
    student, sessionName: CUR_SESSION, termName: CUR_TERM, items, dueDate: due,
    createdBy: "Mr. Daniel Eze", historical: false,
  });

  // payment status mix
  const roll = rng();
  let plan;
  if (roll < 0.3) {
    plan = [[1, pick(["Bank Transfer", "POS", "Cash"]), null]];
  } else if (roll < 0.42) {
    plan = [[0.6, pick(["Bank Transfer", "POS"]), null], [0.4, pick(["Cash", "POS", "Bank Transfer"]), null]];
  } else if (roll < 0.62) {
    plan = [[pick([0.25, 0.3, 0.4, 0.5]), pick(["Cash", "Bank Transfer", "POS"]), null]];
  } else if (roll < 0.66) {
    plan = [[pick([0.3, 0.5]), "Online", "demo"]];
  } else {
    plan = [];
  }
  const base = new Date(2026, 8, randInt(1, 12)); // Sept 1–12, 2026
  const paid = settleInvoice(inv, student, plan, base);
  collectedCurrent += paid;
  count++;
}

// Historical: 2025/2026 Third Term — all fully paid
for (const student of students.filter((s) => s.status === "ACTIVE")) {
  const feeRows = db.prepare(
    `SELECT f.id, f.name, f.amount, fc.name AS cat FROM fees f JOIN fee_categories fc ON fc.id = f.category_id
     WHERE f.class_id = ? AND f.session_id = ? AND f.term_id = ? AND f.status = 'ACTIVE'`
  ).all(classes[student.clsName].id, sessionIds["2025/2026"], termIds["2025/2026"]["Third Term"]);
  if (feeRows.length === 0) continue;
  const items = feeRows.map((f) => ({ description: `${f.name} — ${f.cat}`, amount: f.amount, feeId: f.id }));
  const inv = addInvoice({
    student, sessionName: "2025/2026", termName: "Third Term", items, dueDate: "2026-05-15",
    createdBy: "Mr. Daniel Eze", historical: true,
  });
  const plan = chance(0.5)
    ? [[1, pick(["Bank Transfer", "POS", "Cash"]), null]]
    : [[0.55, pick(["Bank Transfer", "Cash"]), null], [0.45, pick(["POS", "Bank Transfer"]), null]];
  settleInvoice(inv, student, plan, new Date(2026, 4, randInt(1, 20)));
}

// A few payments recorded TODAY (so "Today's Payments" is non-zero)
const recentUnpaid = db.prepare(
  `SELECT i.id, i.student_id, i.balance FROM invoices i WHERE i.session_id = ? AND i.balance > 0 AND i.status != 'CANCELLED' ORDER BY RANDOM() LIMIT 4`
).all(sid);
for (const r of recentUnpaid) {
  const amount = Math.min(r.balance, Math.round(r.balance * pick([0.5, 1])));
  const p = addPayment({ invoiceId: r.id, studentId: r.student_id, amount, method: pick(["Cash", "Bank Transfer", "POS"]), channel: null, date: TODAY, txRef: null });
  const inv = db.prepare(`SELECT total_amount, amount_paid FROM invoices WHERE id = ?`).get(r.id);
  const newPaid = inv.amount_paid + amount;
  run(`UPDATE invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?`,
    [newPaid, Math.max(inv.total_amount - newPaid, 0), newPaid >= inv.total_amount ? "FULLY_PAID" : "PARTIALLY_PAID", r.id]);
}

// --- Notifications & audit logs ------------------------------------------------------
const notifyRows = [
  [adminIds[0], "Payment recorded", "₦70,000 payment recorded for a Primary 5 student.", "success", "/payments"],
  [adminIds[0], "New student enrolled", "A new student was enrolled into JSS 1 for 2026/2027.", "info", "/students"],
  [adminIds[0], "Fee structure created", "First Term 2026/2027 fee structures were created for all classes.", "info", "/fees"],
  [adminIds[0], "Payment overdue", "Some invoices passed their due date with outstanding balances. Review the debtors list.", "warning", "/debtors"],
  [teacherUserId, "Class assignment", "You are the class teacher of Primary 5 for 2026/2027 First Term.", "info", "/classes"],
  [parentUser, "Invoice generated", `Termly fee invoice for ${p5Students[0].first} — ${CUR_SESSION} ${CUR_TERM} is now available.`, "info", "/billing"],
  [parentUser, "Payment reminder", "Kindly note any outstanding balance on your ward's invoice. Thank you.", "warning", "/billing"],
];
for (const [uid, title, message, type, link] of notifyRows) {
  insert(`INSERT INTO notifications (user_id, title, message, type, link, read_status) VALUES (?, ?, ?, ?, ?, 0)`, [uid, title, message, type, link]);
}

const auditRows = [
  ["Mrs. Grace Obi", "Created academic session 2026/2027", "AcademicSession"],
  ["Mrs. Grace Obi", "Created class Primary 5", "Class"],
  ["Mr. Daniel Eze", "Created fee structure for Primary 5 — First Term 2026/2027", "Fee"],
  ["Mr. Daniel Eze", "Bulk-generated invoices for all classes", "Invoice"],
  ["Mr. Daniel Eze", `Recorded ${money(70000)} payment`, "Payment"],
  ["Mr. Daniel Eze", "Recorded several cash payments at the bursary", "Payment"],
  [`${p5Teacher.first} ${p5Teacher.last}`, "Generated payment invoice for a student", "Invoice"],
  ["Mr. Daniel Eze", "Assigned students to classes for First Term", "StudentClassAssignment"],
];
for (const [userName, action, entity] of auditRows) {
  insert(`INSERT INTO audit_logs (user_id, user_name, action, entity, ip) VALUES (?, ?, ?, ?, '10.0.0.1')`, [adminIds[0], userName, action, entity]);
}

// --- Stats ---------------------------------------------------------------------------
const stats = {
  students: db.prepare(`SELECT COUNT(*) n FROM students`).get().n,
  activeStudents: db.prepare(`SELECT COUNT(*) n FROM students WHERE status='ACTIVE'`).get().n,
  teachers: db.prepare(`SELECT COUNT(*) n FROM teachers`).get().n,
  classes: db.prepare(`SELECT COUNT(*) n FROM classes`).get().n,
  fees: db.prepare(`SELECT COUNT(*) n FROM fees`).get().n,
  invoices: db.prepare(`SELECT COUNT(*) n FROM invoices`).get().n,
  payments: db.prepare(`SELECT COUNT(*) n FROM payments`).get().n,
  expected: db.prepare(`SELECT COALESCE(SUM(total_amount),0) n FROM invoices WHERE session_id = ? AND status != 'CANCELLED'`).get(sid).n,
  collected: db.prepare(`SELECT COALESCE(SUM(amount_paid),0) n FROM invoices WHERE session_id = ? AND status != 'CANCELLED'`).get(sid).n,
  debtors: db.prepare(`SELECT COUNT(DISTINCT student_id) n FROM invoices WHERE session_id = ? AND balance > 0 AND status != 'CANCELLED'`).get(sid).n,
};

console.log("Seed complete ✔");
console.table(stats);
console.log("\nDemo accounts:");
console.log("  Super Admin : superadmin@sfgs.edu.ng  /  Admin@123");
console.log("  Admin       : admin@sfgs.edu.ng       /  Admin@123");
console.log("  Teacher     : teacher@sfgs.edu.ng     /  Teacher@123");
console.log("  Parent      : parent@sfgs.edu.ng      /  Parent@123");

db.close();
