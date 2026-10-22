/**
 * Additive seed: Patna-region hospitals + doctors, and a doctor backfill for
 * any hospital that currently has none.
 *
 * SAFE TO RE-RUN. Unlike src/db/seed.ts (which calls deleteMany), this script
 * never deletes. Hospitals are upserted by slug with $setOnInsert; doctors are
 * skipped when their registrationNumber already exists.
 *
 *   npx ts-node src/db/seed.patna.ts --dry-run      # report only, no writes
 *   npx ts-node src/db/seed.patna.ts                # apply
 *   npx ts-node src/db/seed.patna.ts --fix-corrupt  # also repair the broken
 *                                                   # "patna / Maharashtra" record
 *
 * WARNING: contact phone numbers and e-mail addresses below are PLACEHOLDERS
 * (+9160000000xx and *@example.com). Hospital names, areas and coordinates are
 * real; doctor names are fictional. Replace contact details with verified data
 * before using this in production.
 */
import dotenv from "dotenv";
import { connectMongo } from "./mongoose";
import { HospitalModel } from "../modules/hospitals/hospital.schema";
import { DoctorModel } from "../modules/doctors/doctor.schema";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/user_configuration";

const DRY = process.argv.includes("--dry-run");
const FIX_CORRUPT = process.argv.includes("--fix-corrupt");

// ── helpers ────────────────────────────────────────────────────────────────
type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

const timings = (open: string, close: string) => ({
  mon: { open, close, isClosed: false },
  tue: { open, close, isClosed: false },
  wed: { open, close, isClosed: false },
  thu: { open, close, isClosed: false },
  fri: { open, close, isClosed: false },
  sat: { open, close, isClosed: false },
  sun: { open, close, isClosed: false },
});

const ALWAYS = timings("00:00", "23:59");
const DAY_HOURS = timings("08:00", "20:00");

const photos = (sig: number) => [
  {
    url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&sig=" + sig,
    caption: "Main building",
    order: 0,
  },
  {
    url: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&sig=" + sig,
    caption: "Reception",
    order: 1,
  },
];

const DOC_PHOTO_MALE = "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400";
const DOC_PHOTO_FEMALE = "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400";

const LANG_BY_STATE: Record<string, string[]> = {
  Bihar: ["Hindi", "English", "Bhojpuri"],
  Odisha: ["Odia", "Hindi", "English"],
  Karnataka: ["Kannada", "English", "Hindi"],
  Rajasthan: ["Hindi", "English", "Marwari"],
  "Tamil Nadu": ["Tamil", "English"],
  "Himachal Pradesh": ["Hindi", "English"],
  Maharashtra: ["Marathi", "Hindi", "English"],
};
const langsFor = (state: string) => LANG_BY_STATE[state] ?? ["Hindi", "English"];

const WEEK: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const AMENITIES = ["ICU", "OPD", "Emergency", "Pharmacy", "Laboratory", "Parking", "Ambulance"];

interface DocSeed {
  name: string;
  gender: "male" | "female";
  spec: string;
  qual: string;
  exp: number;
  fee: number;
}

interface HospSeed {
  name: string;
  nameHi: string;
  slug: string;
  area: string;
  city: string;
  pincode: string;
  lng: number;
  lat: number;
  specializations: string[];
  fee: number;
  rating: { avg: number; count: number };
  open24?: boolean;
  amenities?: string[];
  doctors: DocSeed[];
}

// ── 12 Patna-region hospitals (real names, real coordinates) ───────────────
const PATNA_HOSPITALS: HospSeed[] = [
  {
    name: "AIIMS Patna",
    nameHi: "एम्स पटना",
    slug: "aiims-patna",
    area: "Phulwari Sharif",
    city: "Patna",
    pincode: "801507",
    lng: 85.0559,
    lat: 25.5875,
    fee: 100,
    rating: { avg: 4.6, count: 412 },
    open24: true,
    specializations: [
      "cardiology", "neurology", "oncology", "nephrology",
      "general_physician", "emergency_medicine",
    ],
    doctors: [
      { name: "Dr. Ravi Shankar Prasad", gender: "male", spec: "cardiology", qual: "MBBS, MD, DM (Cardiology)", exp: 19, fee: 100 },
      { name: "Dr. Anita Kumari", gender: "female", spec: "neurology", qual: "MBBS, MD, DM (Neurology)", exp: 14, fee: 100 },
      { name: "Dr. Sanjay Kumar Singh", gender: "male", spec: "oncology", qual: "MBBS, MD (Radiotherapy)", exp: 16, fee: 100 },
      { name: "Dr. Preeti Ranjan", gender: "female", spec: "nephrology", qual: "MBBS, MD, DM (Nephrology)", exp: 11, fee: 100 },
    ],
  },
  {
    name: "Indira Gandhi Institute of Medical Sciences",
    nameHi: "इंदिरा गांधी आयुर्विज्ञान संस्थान",
    slug: "igims-patna",
    area: "Sheikhpura, Bailey Road",
    city: "Patna",
    pincode: "800014",
    lng: 85.1035,
    lat: 25.612,
    fee: 150,
    rating: { avg: 4.4, count: 338 },
    open24: true,
    specializations: [
      "cardiology", "gastroenterology", "ophthalmology",
      "orthopedics", "general_physician", "emergency_medicine",
    ],
    doctors: [
      { name: "Dr. Manoj Kumar Verma", gender: "male", spec: "gastroenterology", qual: "MBBS, MD, DM (Gastroenterology)", exp: 17, fee: 150 },
      { name: "Dr. Sunita Sinha", gender: "female", spec: "ophthalmology", qual: "MBBS, MS (Ophthalmology)", exp: 13, fee: 150 },
      { name: "Dr. Alok Ranjan", gender: "male", spec: "orthopedics", qual: "MBBS, MS (Orthopaedics)", exp: 15, fee: 150 },
      { name: "Dr. Kavita Jha", gender: "female", spec: "cardiology", qual: "MBBS, MD (Medicine)", exp: 10, fee: 150 },
    ],
  },
  {
    name: "Patna Medical College and Hospital",
    nameHi: "पटना मेडिकल कॉलेज एवं अस्पताल",
    slug: "pmch-patna",
    area: "Ashok Rajpath",
    city: "Patna",
    pincode: "800004",
    lng: 85.169,
    lat: 25.6203,
    fee: 50,
    rating: { avg: 4.1, count: 587 },
    open24: true,
    specializations: [
      "general_physician", "surgery", "pediatrics",
      "gynecology", "orthopedics", "emergency_medicine",
    ],
    doctors: [
      { name: "Dr. Birendra Prasad Yadav", gender: "male", spec: "surgery", qual: "MBBS, MS (General Surgery)", exp: 22, fee: 50 },
      { name: "Dr. Rekha Devi", gender: "female", spec: "gynecology", qual: "MBBS, MS (Obstetrics & Gynaecology)", exp: 18, fee: 50 },
      { name: "Dr. Ashok Kumar Mishra", gender: "male", spec: "pediatrics", qual: "MBBS, MD (Paediatrics)", exp: 20, fee: 50 },
      { name: "Dr. Nutan Kumari", gender: "female", spec: "general_physician", qual: "MBBS, MD (Medicine)", exp: 9, fee: 50 },
    ],
  },
  {
    name: "Nalanda Medical College and Hospital",
    nameHi: "नालंदा मेडिकल कॉलेज अस्पताल",
    slug: "nmch-patna",
    area: "Kankarbagh",
    city: "Patna",
    pincode: "800026",
    lng: 85.165,
    lat: 25.596,
    fee: 50,
    rating: { avg: 4.0, count: 401 },
    open24: true,
    specializations: [
      "general_physician", "pulmonology", "dermatology",
      "psychiatry", "emergency_medicine",
    ],
    doctors: [
      { name: "Dr. Shailendra Kumar", gender: "male", spec: "pulmonology", qual: "MBBS, MD (Pulmonary Medicine)", exp: 14, fee: 50 },
      { name: "Dr. Archana Kumari", gender: "female", spec: "dermatology", qual: "MBBS, MD (Dermatology)", exp: 11, fee: 50 },
      { name: "Dr. Vinay Kumar Sharma", gender: "male", spec: "psychiatry", qual: "MBBS, MD (Psychiatry)", exp: 12, fee: 50 },
      { name: "Dr. Ritu Raj", gender: "female", spec: "general_physician", qual: "MBBS", exp: 7, fee: 50 },
    ],
  },
  {
    name: "Paras HMRI Hospital",
    nameHi: "पारस एचएमआरआई अस्पताल",
    slug: "paras-hmri-patna",
    area: "Raja Bazar, Bailey Road",
    city: "Patna",
    pincode: "800014",
    lng: 85.0975,
    lat: 25.61,
    fee: 800,
    rating: { avg: 4.5, count: 264 },
    open24: true,
    specializations: ["cardiology", "neurology", "orthopedics", "urology", "oncology"],
    doctors: [
      { name: "Dr. Amitabh Ranjan", gender: "male", spec: "cardiology", qual: "MBBS, MD, DM (Cardiology)", exp: 21, fee: 900 },
      { name: "Dr. Shweta Priya", gender: "female", spec: "neurology", qual: "MBBS, DM (Neurology)", exp: 12, fee: 800 },
      { name: "Dr. Rakesh Ranjan Sinha", gender: "male", spec: "urology", qual: "MBBS, MS, MCh (Urology)", exp: 15, fee: 850 },
      { name: "Dr. Neha Agarwal", gender: "female", spec: "orthopedics", qual: "MBBS, MS (Orthopaedics)", exp: 10, fee: 800 },
    ],
  },
  {
    name: "Ruban Memorial Hospital",
    nameHi: "रूबन मेमोरियल अस्पताल",
    slug: "ruban-memorial-patna",
    area: "Patliputra Colony",
    city: "Patna",
    pincode: "800013",
    lng: 85.109,
    lat: 25.621,
    fee: 700,
    rating: { avg: 4.3, count: 198 },
    specializations: ["orthopedics", "cardiology", "gastroenterology", "general_physician"],
    doctors: [
      { name: "Dr. Satyajit Kumar", gender: "male", spec: "orthopedics", qual: "MBBS, MS (Orthopaedics)", exp: 18, fee: 700 },
      { name: "Dr. Madhuri Kumari", gender: "female", spec: "gastroenterology", qual: "MBBS, MD, DM (Gastroenterology)", exp: 13, fee: 750 },
      { name: "Dr. Pankaj Kumar Gupta", gender: "male", spec: "cardiology", qual: "MBBS, MD (Medicine)", exp: 16, fee: 700 },
      { name: "Dr. Swati Bhardwaj", gender: "female", spec: "general_physician", qual: "MBBS, MD", exp: 8, fee: 600 },
    ],
  },
  {
    name: "Big Apollo Spectra Hospital",
    nameHi: "बिग अपोलो स्पेक्ट्रा अस्पताल",
    slug: "big-apollo-spectra-patna",
    area: "Agamkuan",
    city: "Patna",
    pincode: "800007",
    lng: 85.172,
    lat: 25.605,
    fee: 750,
    rating: { avg: 4.4, count: 221 },
    specializations: ["orthopedics", "surgery", "ent", "urology", "general_physician"],
    doctors: [
      { name: "Dr. Nishant Kumar", gender: "male", spec: "orthopedics", qual: "MBBS, MS (Orthopaedics)", exp: 14, fee: 750 },
      { name: "Dr. Priyanka Singh", gender: "female", spec: "ent", qual: "MBBS, MS (ENT)", exp: 9, fee: 700 },
      { name: "Dr. Abhishek Anand", gender: "male", spec: "surgery", qual: "MBBS, MS (General Surgery)", exp: 12, fee: 750 },
      { name: "Dr. Ruchi Kumari", gender: "female", spec: "general_physician", qual: "MBBS", exp: 6, fee: 500 },
    ],
  },
  {
    name: "Mediversal Multi Super Speciality Hospital",
    nameHi: "मेडिवर्सल मल्टी सुपर स्पेशलिटी अस्पताल",
    slug: "mediversal-patna",
    area: "Kidwaipuri",
    city: "Patna",
    pincode: "800001",
    lng: 85.129,
    lat: 25.615,
    fee: 800,
    rating: { avg: 4.5, count: 176 },
    specializations: ["nephrology", "cardiology", "neurology", "endocrinology", "general_physician"],
    doctors: [
      { name: "Dr. Gaurav Kumar Jha", gender: "male", spec: "nephrology", qual: "MBBS, MD, DM (Nephrology)", exp: 15, fee: 850 },
      { name: "Dr. Shalini Kumari", gender: "female", spec: "endocrinology", qual: "MBBS, MD, DM (Endocrinology)", exp: 11, fee: 800 },
      { name: "Dr. Deepak Narayan", gender: "male", spec: "cardiology", qual: "MBBS, DM (Cardiology)", exp: 17, fee: 900 },
      { name: "Dr. Aarti Sinha", gender: "female", spec: "neurology", qual: "MBBS, MD (Medicine)", exp: 10, fee: 800 },
    ],
  },
  {
    name: "Ford Hospital and Research Centre",
    nameHi: "फोर्ड अस्पताल एवं अनुसंधान केंद्र",
    slug: "ford-hospital-patna",
    area: "New Bypass Road, Khemnichak",
    city: "Patna",
    pincode: "800027",
    lng: 85.145,
    lat: 25.579,
    fee: 600,
    rating: { avg: 4.2, count: 143 },
    specializations: ["gynecology", "pediatrics", "general_physician", "orthopedics"],
    doctors: [
      { name: "Dr. Meenakshi Sharan", gender: "female", spec: "gynecology", qual: "MBBS, MS (Obstetrics & Gynaecology)", exp: 16, fee: 650 },
      { name: "Dr. Rajeev Ranjan Kumar", gender: "male", spec: "pediatrics", qual: "MBBS, MD (Paediatrics)", exp: 13, fee: 600 },
      { name: "Dr. Poonam Kumari", gender: "female", spec: "general_physician", qual: "MBBS, MD", exp: 8, fee: 500 },
      { name: "Dr. Sudhir Kumar Das", gender: "male", spec: "orthopedics", qual: "MBBS, D.Ortho", exp: 11, fee: 600 },
    ],
  },
  {
    name: "Kurji Holy Family Hospital",
    nameHi: "कुर्जी होली फैमिली अस्पताल",
    slug: "kurji-holy-family-patna",
    area: "Sadaqat Ashram, Kurji",
    city: "Patna",
    pincode: "800010",
    lng: 85.087,
    lat: 25.63,
    fee: 300,
    rating: { avg: 4.3, count: 302 },
    open24: true,
    specializations: ["gynecology", "pediatrics", "general_physician", "surgery", "ophthalmology"],
    doctors: [
      { name: "Dr. Elizabeth Thomas", gender: "female", spec: "gynecology", qual: "MBBS, MS (Obstetrics & Gynaecology)", exp: 20, fee: 350 },
      { name: "Dr. Francis Xavier", gender: "male", spec: "pediatrics", qual: "MBBS, DCH", exp: 18, fee: 300 },
      { name: "Dr. Sneha Kujur", gender: "female", spec: "ophthalmology", qual: "MBBS, MS (Ophthalmology)", exp: 9, fee: 300 },
      { name: "Dr. Anil Kumar Toppo", gender: "male", spec: "surgery", qual: "MBBS, MS (General Surgery)", exp: 14, fee: 350 },
    ],
  },
  {
    name: "Sadar Hospital Danapur",
    nameHi: "सदर अस्पताल दानापुर",
    slug: "sadar-hospital-danapur",
    area: "Danapur Cantonment",
    city: "Danapur",
    pincode: "801503",
    lng: 85.047,
    lat: 25.635,
    fee: 0,
    rating: { avg: 3.8, count: 96 },
    open24: true,
    amenities: ["OPD", "Emergency", "Pharmacy", "Ambulance"],
    specializations: ["general_physician", "pediatrics", "gynecology", "emergency_medicine"],
    doctors: [
      { name: "Dr. Umesh Prasad", gender: "male", spec: "general_physician", qual: "MBBS", exp: 15, fee: 0 },
      { name: "Dr. Sarita Kumari", gender: "female", spec: "gynecology", qual: "MBBS, DGO", exp: 12, fee: 0 },
      { name: "Dr. Mithilesh Kumar", gender: "male", spec: "pediatrics", qual: "MBBS, DCH", exp: 10, fee: 0 },
      { name: "Dr. Bindu Rani", gender: "female", spec: "emergency_medicine", qual: "MBBS", exp: 6, fee: 0 },
    ],
  },
  {
    name: "Sadar Hospital Hajipur",
    nameHi: "सदर अस्पताल हाजीपुर",
    slug: "sadar-hospital-hajipur",
    area: "Hospital Road, Vaishali",
    city: "Hajipur",
    pincode: "844101",
    lng: 85.208,
    lat: 25.685,
    fee: 0,
    rating: { avg: 3.7, count: 84 },
    open24: true,
    amenities: ["OPD", "Emergency", "Pharmacy", "Ambulance"],
    specializations: ["general_physician", "orthopedics", "pediatrics", "emergency_medicine"],
    doctors: [
      { name: "Dr. Ram Naresh Singh", gender: "male", spec: "general_physician", qual: "MBBS", exp: 17, fee: 0 },
      { name: "Dr. Kiran Kumari", gender: "female", spec: "pediatrics", qual: "MBBS, DCH", exp: 9, fee: 0 },
      { name: "Dr. Dinesh Paswan", gender: "male", spec: "orthopedics", qual: "MBBS, D.Ortho", exp: 11, fee: 0 },
      { name: "Dr. Anjali Roy", gender: "female", spec: "emergency_medicine", qual: "MBBS", exp: 5, fee: 0 },
    ],
  },
];

// ── generic name pools for the backfill ────────────────────────────────────
const MALE_NAMES = [
  "Dr. Arun Mehta", "Dr. Vikram Nair", "Dr. Sandeep Rao", "Dr. Harish Patel",
  "Dr. Nikhil Joshi", "Dr. Rohit Malhotra", "Dr. Suresh Iyer", "Dr. Karan Bedi",
  "Dr. Aditya Chauhan", "Dr. Mohit Saxena", "Dr. Vivek Pillai", "Dr. Rahul Deshmukh",
  "Dr. Imran Sheikh", "Dr. Tarun Bansal", "Dr. Girish Hegde", "Dr. Prakash Reddy",
];
const FEMALE_NAMES = [
  "Dr. Kavya Menon", "Dr. Divya Shetty", "Dr. Ananya Bose", "Dr. Ritika Kapoor",
  "Dr. Sneha Kulkarni", "Dr. Pooja Raut", "Dr. Nandini Rao", "Dr. Farah Qureshi",
  "Dr. Lakshmi Narayan", "Dr. Ishita Chatterjee", "Dr. Megha Trivedi", "Dr. Arpita Sen",
  "Dr. Shruti Vaidya", "Dr. Namrata Gill", "Dr. Vaishali More", "Dr. Deepika Suri",
];

const QUAL_BY_SPEC: Record<string, string> = {
  cardiology: "MBBS, MD, DM (Cardiology)",
  neurology: "MBBS, MD, DM (Neurology)",
  orthopedics: "MBBS, MS (Orthopaedics)",
  pediatrics: "MBBS, MD (Paediatrics)",
  dermatology: "MBBS, MD (Dermatology)",
  gynecology: "MBBS, MS (Obstetrics & Gynaecology)",
  oncology: "MBBS, MD (Oncology)",
  urology: "MBBS, MS, MCh (Urology)",
  gastroenterology: "MBBS, MD, DM (Gastroenterology)",
  pulmonology: "MBBS, MD (Pulmonary Medicine)",
  nephrology: "MBBS, MD, DM (Nephrology)",
  endocrinology: "MBBS, MD, DM (Endocrinology)",
  psychiatry: "MBBS, MD (Psychiatry)",
  dental: "BDS, MDS",
  ent: "MBBS, MS (ENT)",
  ophthalmology: "MBBS, MS (Ophthalmology)",
  general_physician: "MBBS, MD (General Medicine)",
  emergency_medicine: "MBBS, MD (Emergency Medicine)",
  surgery: "MBBS, MS (General Surgery)",
  radiology: "MBBS, MD (Radiodiagnosis)",
  hepatology: "MBBS, MD, DM (Hepatology)",
  rheumatology: "MBBS, MD, DM (Rheumatology)",
  pathology: "MBBS, MD (Pathology)",
  anesthesiology: "MBBS, MD (Anaesthesiology)",
  physical_therapy: "BPT, MPT",
};

// ── builders ───────────────────────────────────────────────────────────────
function buildHospitalDoc(h: HospSeed, idx: number) {
  return {
    name: h.name,
    localizedName: { hi: h.nameHi },
    slug: h.slug,
    description:
      h.name +
      " is a multi-speciality hospital in " +
      h.area +
      ", " +
      h.city +
      ", Bihar, offering " +
      h.specializations.length +
      " clinical departments.",
    location: { type: "Point" as const, coordinates: [h.lng, h.lat] },
    address: h.area + ", " + h.city + " - " + h.pincode,
    city: h.city,
    state: "Bihar",
    pincode: h.pincode,
    country: "India",
    contactPhone: "+9160000000" + String(idx).padStart(2, "0"),
    whatsappNumber: "+9160000000" + String(idx).padStart(2, "0"),
    contactEmail: h.slug + "@example.com",
    specializations: h.specializations,
    amenities: h.amenities ?? AMENITIES,
    photos: photos(h.lat * 1000),
    timings: h.open24 ? ALWAYS : DAY_HOURS,
    holidays: [],
    acceptedInsurancePlans: [],
    startingConsultationFee: h.fee,
    rating: h.rating,
    status: "active" as const,
    isVerified: true,
    verifiedAt: new Date(),
    deletedAt: null,
  };
}

function buildDoctorDoc(
  d: DocSeed,
  hospitalId: any,
  reg: string,
  state: string,
  dayOffset: number,
) {
  const days: Day[] = [
    WEEK[dayOffset % WEEK.length],
    WEEK[(dayOffset + 2) % WEEK.length],
    WEEK[(dayOffset + 4) % WEEK.length],
  ];
  return {
    name: d.name,
    photoUrl: d.gender === "female" ? DOC_PHOTO_FEMALE : DOC_PHOTO_MALE,
    qualification: d.qual,
    primarySpecialization: d.spec,
    languages: langsFor(state),
    experienceYears: d.exp,
    registrationNumber: reg,
    bio:
      d.name +
      " is a " +
      d.spec.replace(/_/g, " ") +
      " specialist with " +
      d.exp +
      " years of clinical experience.",
    gender: d.gender,
    hospitalAffiliations: [
      { hospitalId, consultationFee: d.fee, isPrimary: true, joinedAt: new Date() },
    ],
    availability: days.map((dayOfWeek) => ({
      hospitalId,
      dayOfWeek,
      startTime: "10:00",
      endTime: "14:00",
    })),
    rating: {
      avg: Number((3.8 + ((d.exp % 12) / 10)).toFixed(1)), // max 4.9
      count: 20 + ((d.exp * 7) % 180),
    },
    isActive: true,
    deletedAt: null,
  };
}

// ── steps ──────────────────────────────────────────────────────────────────
async function seedPatnaHospitals() {
  console.log("\n== Patna region hospitals ==");
  let created = 0;
  let existed = 0;
  const ids: { seed: HospSeed; id: any }[] = [];

  for (const [idx, h] of PATNA_HOSPITALS.entries()) {
    const existing = await HospitalModel.findOne({ slug: h.slug, deletedAt: null });
    if (existing) {
      existed++;
      ids.push({ seed: h, id: existing._id });
      console.log("  = exists  " + h.name);
      continue;
    }
    if (DRY) {
      created++;
      ids.push({ seed: h, id: null });
      console.log("  + would create  " + h.name + "  [" + h.lng + ", " + h.lat + "]");
      continue;
    }
    const doc = await HospitalModel.create(buildHospitalDoc(h, idx + 1));
    created++;
    ids.push({ seed: h, id: doc._id });
    console.log("  + created  " + h.name + "  " + doc._id);
  }
  console.log("  hospitals created=" + created + " already-present=" + existed);
  return ids;
}

async function seedPatnaDoctors(pairs: { seed: HospSeed; id: any }[]) {
  console.log("\n== Doctors for Patna region hospitals ==");
  let created = 0;
  let skipped = 0;
  let n = 0;

  for (const { seed, id } of pairs) {
    for (const d of seed.doctors) {
      n++;
      const reg = "BR-P-" + String(n).padStart(3, "0");
      const dup = await DoctorModel.findOne({ registrationNumber: reg });
      if (dup) {
        skipped++;
        continue;
      }
      if (DRY) {
        created++;
        console.log("  + would create  " + d.name + " (" + d.spec + ") @ " + seed.name);
        continue;
      }
      await DoctorModel.create(buildDoctorDoc(d, id, reg, "Bihar", n));
      created++;
      console.log("  + " + reg + "  " + d.name + " (" + d.spec + ") @ " + seed.name);
    }
  }
  console.log("  doctors created=" + created + " skipped-existing=" + skipped);
}

async function backfillDoctorlessHospitals() {
  console.log("\n== Backfill: hospitals with zero doctors ==");
  // Only hospitals the public site can actually show. Unverified / non-active
  // records are invisible to GET /hospitals, so doctors there serve no purpose
  // and would only make junk records look legitimate.
  const hospitals = await HospitalModel.find({
    deletedAt: null,
    isVerified: true,
    status: "active",
  }).lean();

  const skipped = await HospitalModel.countDocuments({
    deletedAt: null,
    $or: [{ isVerified: false }, { status: { $ne: "active" } }],
  });
  if (skipped > 0) {
    console.log(
      "  note: skipping " + skipped + " unverified/non-active hospital(s) - not publicly visible",
    );
  }

  let created = 0;
  let touched = 0;
  let n = 0;

  for (const h of hospitals as any[]) {
    const count = await DoctorModel.countDocuments({
      "hospitalAffiliations.hospitalId": h._id,
      deletedAt: null,
    });
    if (count > 0) continue;

    touched++;
    const specs: string[] =
      Array.isArray(h.specializations) && h.specializations.length
        ? h.specializations
        : ["general_physician"];

    for (let i = 0; i < 3; i++) {
      n++;
      const reg = "IN-BF-" + String(n).padStart(3, "0");
      const dup = await DoctorModel.findOne({ registrationNumber: reg });
      if (dup) continue;

      const spec = specs[i % specs.length];
      const female = n % 2 === 0;
      const pool = female ? FEMALE_NAMES : MALE_NAMES;
      const seedDoc: DocSeed = {
        name: pool[n % pool.length],
        gender: female ? "female" : "male",
        spec,
        qual: QUAL_BY_SPEC[spec] ?? "MBBS, MD",
        exp: 5 + (n % 20),
        fee: Math.max(0, Number(h.startingConsultationFee ?? 300)),
      };

      if (DRY) {
        created++;
        continue;
      }
      await DoctorModel.create(
        buildDoctorDoc(seedDoc, h._id, reg, String(h.state ?? ""), n),
      );
      created++;
    }
    console.log("  + 3 doctors -> " + h.name + " (" + h.city + ")");
  }
  console.log("  hospitals backfilled=" + touched + " doctors created=" + created);
}

async function fixCorruptPatnaRecord() {
  console.log("\n== Repair corrupt Patna record ==");
  const bad = await HospitalModel.findOne({
    city: { $regex: "^patna$", $options: "i" },
    state: { $ne: "Bihar" },
    deletedAt: null,
  });
  if (!bad) {
    console.log("  nothing to repair");
    return;
  }
  console.log("  found: " + bad.name + " id=" + bad._id);
  console.log("    was: city=" + bad.city + " state=" + bad.state + " coords=" + JSON.stringify(bad.location?.coordinates));
  if (DRY) {
    console.log("    would set: city=Patna state=Bihar coords=[85.1500, 25.5850]");
    return;
  }
  bad.city = "Patna";
  bad.state = "Bihar";
  bad.address = "Kankarbagh Main Road, Patna - 800020";
  bad.pincode = "800020";
  bad.location = { type: "Point", coordinates: [85.15, 25.585] } as any;
  await bad.save();
  console.log("    repaired -> Patna, Bihar [85.1500, 25.5850]");
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY ? "DRY RUN - no writes will be made" : "APPLYING CHANGES");
  await connectMongo(MONGODB_URI);

  const pairs = await seedPatnaHospitals();
  await seedPatnaDoctors(pairs);

  if (FIX_CORRUPT) await fixCorruptPatnaRecord();

  await backfillDoctorlessHospitals();

  console.log("\nDone." + (DRY ? " (dry run - nothing written)" : ""));
  process.exit(0);
}

main().catch((error) => {
  console.error("seed.patna failed:", error);
  process.exit(1);
});
