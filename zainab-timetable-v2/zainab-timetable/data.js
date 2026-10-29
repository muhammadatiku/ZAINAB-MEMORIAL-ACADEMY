// data.js - the school's information. Edit this file to change names, times and the starting timetable.
const SCHOOL = {
  name: "Zainab Memorial Academy",
  motto: "For Brighter Future",
  address: "Along Mani Road, behind NYSC Camp, Katsina",
  phone: "",   // add later
  email: "",   // add later
  color: "#954f43"
};

const CLASSES = ["JS1A","JS1B","JS2A","JS2B","JS3A","JS3B","SS1","SS2","SS3"];

// Time slots from the pink master sheet. A third value means it is a break row, not a lesson.
const SLOTS = {
  mt: [["08:15","08:50"],["08:50","09:25"],["09:25","10:00"],["10:00","10:40","Breakfast"],
       ["10:40","11:15"],["11:15","11:50"],["11:50","12:25"],["12:25","13:00"],["13:00","","Short break"]],
  fri: [["08:10","08:45"],["08:45","09:20"],["09:20","09:55"],["09:55","10:30","Break"],
        ["10:30","11:00"],["11:00","11:30"],["11:30","12:00"]]
};

// Starting timetable. Each class has 5 days; Mon-Thu have 7 lessons, Friday has 6.
// Use "/" for two subjects at the same time. A "?" means the handwriting was unclear.
// Only SS2 is filled so far (from the typed sheet). Fill the rest in the Admin page.
const SEED = {
  SS2: [
    ["BIO","BIO","ENG","MATHS","MATHS","CHEM / LIT","CHEM / LIT"],
    ["CIVIC","AGRIC / ECONS","AGRIC / ECONS","F.MATHS / GOVT","ISLAMIC","LIVESTOCK / FARMING","LIVESTOCK / FARMING"],
    ["PHY / HAUSA","ENG","CIVIC","MATHS","MATHS","COMPUTER","COMPUTER"],
    ["PHY / LIT","ISLAMIC","MATHS","BIO","BIO","EXTRA CURRICULUM","EXTRA CURRICULUM"],
    ["PHY / HAUSA","PHY / HAUSA","F.MATHS / LIBRARY","ENG","CHEM / ECONS","CHEM / ECONS"]
  ]
};

// Demo teacher. Teachers see every lesson, in every class, that matches their subjects.
const TEACHERS_SEED = [{name:"Demo Teacher", user:"teacher", pass:"teacher123", subjects:["MATHS"], classes:[], phone:"", email:""}];

// The server serves the website, so the site talks to the same address it was opened from.
const API_URL = location.protocol.startsWith("http") ? location.origin : "";
