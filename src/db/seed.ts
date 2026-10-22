import dotenv from "dotenv";
import { connectMongo } from "./mongoose";
import { UserModel } from "../modules/users/user.schema";
import { HospitalModel } from "../modules/hospitals/hospital.schema";
import { DoctorModel } from "../modules/doctors/doctor.schema";
import { ReviewModel } from "../modules/reviews/review.model";
import { BloodDonorModel } from "../modules/blood_donor/blood_donor.schema";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/user_configuration";

const defaultTimings = {
  mon: { open: "08:00", close: "22:00", isClosed: false },
  tue: { open: "08:00", close: "22:00", isClosed: false },
  wed: { open: "08:00", close: "22:00", isClosed: false },
  thu: { open: "08:00", close: "22:00", isClosed: false },
  fri: { open: "08:00", close: "22:00", isClosed: false },
  sat: { open: "09:00", close: "21:00", isClosed: false },
  sun: { open: "09:00", close: "21:00", isClosed: false },
};

async function seed(): Promise<void> {
  console.log("Seed script started");
  await connectMongo(MONGODB_URI);

  await seedUsers();
  const hospitals = await seedHospitals();
  await seedDoctors(hospitals);
  await seedReviews(hospitals);
  await seedBloodDonors();

  console.log("Seed completed successfully");
  process.exit(0);
}

async function seedUsers(): Promise<void> {
  const usersToSeed = [
    {
      phone: "+919561762989",
      role: "user",
      isPhoneVerified: true,
      isActive: true,
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: new Date("1990-01-15"),
      gender: "female",
      address: {
        line: "123 Main Street",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560001",
        location: { type: "Point", coordinates: [77.6245, 12.9716] },
      },
    },
    {
      phone: "+919420213209",
      role: "platform_admin",
      isPhoneVerified: true,
      isActive: true,
      firstName: "Admin",
      lastName: "User",
    },
  ];

  for (const u of usersToSeed) {
    await UserModel.findOneAndUpdate({ phone: u.phone }, u, { upsert: true });
  }

  console.log("Created seed users");
}

// Hindi and Odia names for all seeded hospitals
const HOSPITAL_LOCALIZED_NAMES: Record<string, { hi: string; or: string }> = {
  "Apollo Hospitals":                { hi: "अपोलो अस्पताल",                          or: "ଆପୋଲୋ ହସ୍ପିଟାଲ" },
  "Manipal Hospital":                { hi: "मणिपाल अस्पताल",                          or: "ମଣିପାଲ ହସ୍ପିଟାଲ" },
  "Fortis Hospital":                 { hi: "फोर्टिस अस्पताल",                         or: "ଫୋର୍ଟିସ ହସ୍ପିଟାଲ" },
  "Max Healthcare":                  { hi: "मैक्स हेल्थकेयर",                          or: "ମ୍ୟାକ୍ସ ହେଲ୍‌ଥକେୟାର" },
  "Kauvery Hospital":                { hi: "कौवेरी अस्पताल",                           or: "କୋଭେରୀ ହସ୍ପିଟାଲ" },
  "Aarogya Multispeciality Hospital":{ hi: "आरोग्य मल्टीस्पेशलिटी अस्पताल",            or: "ଆରୋଗ୍ୟ ହସ୍ପିଟାଲ" },
  "Jeevan Jyoti Medical Centre":     { hi: "जीवन ज्योति मेडिकल सेंटर",                 or: "ଜୀବନ ଜ୍ୟୋତି ଚିକିତ୍ସା କେନ୍ଦ୍ର" },
  "Shree Balaji General Hospital":   { hi: "श्री बालाजी जनरल अस्पताल",                 or: "ଶ୍ରୀ ବାଳାଜୀ ଜେନେରାଲ ହସ୍ପିଟାଲ" },
  "Sunrise Super Speciality Hospital":{ hi: "सनराइज सुपर स्पेशलिटी अस्पताल",           or: "ସନ୍‌ରାଇଜ ସୁପର ସ୍ପେଶ୍ୟାଲିଟି ହସ୍ପିଟାଲ" },
  "Radius Care Hospital":            { hi: "रेडियस केयर अस्पताल",                      or: "ରେଡ଼ିୟସ କେୟାର ହସ୍ପିଟାଲ" },
  "Hoskote City Care Hospital":      { hi: "होस्कोटे सिटी केयर अस्पताल",               or: "ହୋସ୍‌କୋଟ ସିଟି କେୟାର ହସ୍ପିଟାଲ" },
  "Nelamangala Health Centre":       { hi: "नेलमंगला हेल्थ सेंटर",                     or: "ନେଲମଙ୍ଗଲ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର" },
  "Ramanagara Multi Care":           { hi: "रामनगर मल्टी केयर",                        or: "ରାମନଗର ମଲ୍ଟି କେୟାର" },
  "Hosur Family Hospital":           { hi: "होसूर फैमिली अस्पताल",                     or: "ହୋସୁର ଫ୍ୟାମିଲି ହସ୍ପିଟାଲ" },
  "Apollo Care Hospital":            { hi: "अपोलो केयर अस्पताल",                       or: "ଆପୋଲୋ କେୟାର ହସ୍ପିଟାଲ" },
  "Medanta Super Speciality":        { hi: "मेदांता सुपर स्पेशलिटी",                   or: "ମେଦାନ୍ତା ସୁପର ସ୍ପେଶ୍ୟାଲିଟି" },
  "Fortis Prime Hospital":           { hi: "फोर्टिस प्राइम अस्पताल",                   or: "ଫୋର୍ଟିସ ପ୍ରାଇମ ହସ୍ପିଟାଲ" },
  "Max Wellness Centre":             { hi: "मैक्स वेलनेस सेंटर",                        or: "ମ୍ୟାକ୍ସ ୱେଲ‌ନେସ ସେଣ୍ଟର" },
  "CureWell Multispeciality":        { hi: "क्योरवेल मल्टीस्पेशलिटी",                  or: "କ୍ୟୋରୱେଲ ମଲ୍ଟିସ୍ପେଶ୍ୟାଲିଟି" },
  "LifeLine Advanced Hospital":      { hi: "लाइफलाइन एडवांस्ड अस्पताल",                or: "ଲାଇଫ‌ଲାଇନ ଆଡ‌ଭାନ୍‌ସ ହସ୍ପିଟାଲ" },
  "Sawai Man Singh Hospital":        { hi: "सवाई मान सिंह अस्पताल",                    or: "ସୱାଇ ମାନ ସିଂ ହସ୍ପିଟାଲ" },
  "Fortis Escorts Hospital Jaipur":  { hi: "फोर्टिस एस्कॉर्ट्स अस्पताल जयपुर",         or: "ଫୋର୍ଟିସ ଏସ୍କର୍ଟ ହସ୍ପିଟାଲ ଜୟପୁର" },
  "Narayana Multispeciality Hospital":{ hi: "नारायण मल्टीस्पेशलिटी अस्पताल",           or: "ନାରାୟଣ ମଲ୍ଟିସ୍ପେଶ୍ୟାଲିଟି ହସ୍ପିଟାଲ" },
  "Eternal Hospital Jaipur":         { hi: "इटरनल अस्पताल जयपुर",                      or: "ଇଟର୍ନ‌ଲ ହସ୍ପିଟାଲ ଜୟପୁର" },
  "Mahatma Gandhi Hospital":         { hi: "महात्मा गांधी अस्पताल",                    or: "ମହାତ୍ମା ଗାନ୍ଧୀ ହସ୍ପିଟାଲ" },
  "CK Birla Hospital Jaipur":        { hi: "सीके बिरला अस्पताल जयपुर",                 or: "ସିକେ ବିର୍ଲା ହସ୍ପିଟାଲ ଜୟପୁର" },
  "RUHS College Medical Hospital":   { hi: "राजस्थान यूनिवर्सिटी ऑफ हेल्थ साइंसेस",  or: "ରାଜ‌ସ୍ଥାନ ୟୁନିଭର୍ସିଟି ଅଫ ହେଲ୍‌ଥ ସାୟ‌ନ୍ସ" },
  "Apex Hospital Jaipur":            { hi: "अपेक्स अस्पताल जयपुर",                     or: "ଆପେକ୍ସ ହସ୍ପିଟାଲ ଜୟପୁର" },
  "Tanda Medical College Hospital":  { hi: "टांडा मेडिकल कॉलेज अस्पताल",               or: "ଟାଣ୍ଡା ମେଡ‌ିକ‌ଲ କଲେଜ ହସ୍ପିଟାଲ" },
  "Fortis Kangra Hospital":          { hi: "फोर्टिस कांगड़ा अस्पताल",                  or: "ଫୋର୍ଟିସ କାଙ୍ଗ୍ରା ହସ୍ପିଟାଲ" },
  "Dharamshala Civil Hospital":      { hi: "धर्मशाला सिविल अस्पताल",                   or: "ଧର୍ମଶାଳା ସିଭ‌ିଲ ହସ୍ପିଟାଲ" },
  "Palampur Multispeciality Hospital":{ hi: "पालमपुर मल्टीस्पेशलिटी अस्पताल",          or: "ପାଲ‌ମ‌ପୁର ମଲ୍ଟିସ୍ପେଶ୍ୟାଲିଟି ହସ୍ପିଟାଲ" },
  "Nagrota Bagwan Community Hospital":{ hi: "नगरोटा बागवान सामुदायिक अस्पताल",         or: "ନ‌ଗ୍ରୋଟ‌ ବ‌ଗ‌ୱ‌ାନ ସ‌ମ‌ୁଦ‌ାୟ ହ‌ସ୍ପ‌ିଟ‌ାଲ" },
  "Kangra Valley Wellness Centre":   { hi: "कांगड़ा वैली वेलनेस सेंटर",                or: "କାଙ୍ଗ୍ରା ଭ‌ାଲ‌ି ୱ‌େଲ‌ନ‌େସ ସ‌େଣ୍ଟ‌ର" },
};

async function seedHospitals() {
  const hospitalSeeds = [
    hospitalSeed({
      name: "Apollo Hospitals",
      slug: "apollo-hospitals",
      localizedName: {
        hi: "अपोलो अस्पताल",
        or: "ଆପୋଲୋ ହସ୍ପିଟାଲ",
      },
      city: "Bangalore",
      pincode: "560016",
      address: "154/11, Opposite Manyata Tech Park, Old Madras Road, Bangalore - 560016",
      coordinates: [77.5946, 12.9716],
      phone: "+919561762989",
      email: "info@apollohospitals.example",
      specializations: ["cardiology", "neurology", "orthopedics", "pediatrics"],
      fee: 500,
      rating: { avg: 4.5, count: 342 },
      photos: [
        { url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800", caption: "Apollo Main Building", order: 0 },
        { url: "https://images.unsplash.com/photo-1588776814546-1ffedbe47add?w=800", caption: "ICU", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Manipal Hospital",
      slug: "manipal-hospital",
      city: "Bangalore",
      pincode: "560017",
      address: "Old Airport Road, Bangalore - 560017",
      coordinates: [77.6245, 12.9716],
      phone: "+919876543210",
      email: "support@manipalhospital.example",
      specializations: ["cardiology", "dental", "dermatology", "general_physician"],
      fee: 400,
      rating: { avg: 4.3, count: 256 },
      photos: [
        { url: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800", caption: "Manipal Entrance", order: 0 },
        { url: "https://images.unsplash.com/photo-1504813184591-01572f98c85f?w=800", caption: "Consultation Room", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Fortis Hospital",
      slug: "fortis-hospital",
      city: "Bangalore",
      pincode: "560076",
      address: "154, Bannerghatta Road, Bangalore - 560076",
      coordinates: [77.5946, 13.0001],
      phone: "+919999888877",
      email: "contact@fortishealthcare.example",
      specializations: ["neurology", "orthopedics", "gynecology", "pediatrics"],
      fee: 450,
      rating: { avg: 4.2, count: 189 },
      photos: [
        { url: "https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=800", caption: "Fortis Hospital", order: 0 },
      ],
    }),
    hospitalSeed({
      name: "Max Healthcare",
      slug: "max-healthcare",
      city: "Bangalore",
      pincode: "560025",
      address: "No. 14, Lakshmi Nivas, Richmond Road, Bangalore - 560025",
      coordinates: [77.6065, 12.9352],
      phone: "+919111222333",
      email: "hello@maxhealthcare.example",
      specializations: ["cardiology", "dental", "ent", "ophthalmology"],
      fee: 350,
      rating: { avg: 4.4, count: 218 },
      photos: [
        { url: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=800", caption: "Max Healthcare", order: 0 },
      ],
    }),
    hospitalSeed({
      name: "Kauvery Hospital",
      slug: "kauvery-hospital",
      city: "Bangalore",
      pincode: "560078",
      address: "Bannerghatta Road, Bangalore - 560078",
      coordinates: [77.572, 12.9716],
      phone: "+919222333444",
      email: "info@kauvery.example",
      specializations: ["cardiology", "gastroenterology", "pulmonology"],
      fee: 400,
      rating: { avg: 4.6, count: 321 },
      photos: [
        { url: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800", caption: "Kauvery Hospital", order: 0 },
      ],
    }),
    // Radius QA hospitals measured from seed user Jane Doe:
    // user location = [77.6245, 12.9716] (Bangalore / MG Road area).
    hospitalSeed({
      name: "Aarogya Multispeciality Hospital",
      slug: "aarogya-multispeciality-hospital",
      city: "Bangalore",
      pincode: "560064",
      address: "Yelahanka Main Road, Bangalore - 560064",
      coordinates: [75.5417864, 27.6982018],
      phone: "+919300000010",
      email: "radius10@example.com",
      specializations: ["general_physician", "cardiology", "pediatrics"],
      fee: 300,
      rating: { avg: 4.1, count: 40 },
      photos: [
        { url: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800", caption: "Main Building", order: 0 },
        { url: "https://images.unsplash.com/photo-1551190822-a9333d879b1f?w=800", caption: "Reception", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Jeevan Jyoti Medical Centre",
      slug: "jeevan-jyoti-medical-centre",
      city: "Bangalore",
      pincode: "562149",
      address: "Bagalur Main Road, Bangalore - 562149",
      coordinates: [75.5417864, 27.788134],
      phone: "+919300000020",
      email: "radius20@example.com",
      specializations: ["orthopedics", "neurology", "general_physician"],
      fee: 350,
      rating: { avg: 4.2, count: 52 },
      photos: [
        { url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800", caption: "Hospital Entrance", order: 0 },
        { url: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=800", caption: "OPD Ward", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Shree Balaji General Hospital",
      slug: "shree-balaji-general-hospital",
      city: "Devanahalli",
      pincode: "562110",
      address: "Airport Road, Devanahalli - 562110",
      coordinates: [75.5417864, 27.8780662],
      phone: "+919300000030",
      email: "radius30@example.com",
      specializations: ["ent", "dental", "general_physician"],
      fee: 375,
      rating: { avg: 4.0, count: 33 },
    }),
    hospitalSeed({
      name: "Sunrise Super Speciality Hospital",
      slug: "sunrise-super-speciality-hospital",
      city: "Devanahalli",
      pincode: "562110",
      address: "Nandi Cross Road, Devanahalli - 562110",
      coordinates: [75.5417864, 27.9679983],
      phone: "+919300000040",
      email: "radius40@example.com",
      specializations: ["cardiology", "gynecology", "pulmonology"],
      fee: 425,
      rating: { avg: 4.3, count: 61 },
    }),
    hospitalSeed({
      name: "Radius Care Hospital",
      slug: "radius-care-hospital",
      city: "Chikkaballapur",
      pincode: "562101",
      address: "BB Road, Chikkaballapur - 562101",
      coordinates: [75.5417864, 28.0579305],
      phone: "+919300000050",
      email: "radius50@example.com",
      specializations: ["dermatology", "ophthalmology", "general_physician"],
      fee: 450,
      rating: { avg: 4.4, count: 74 },
    }),
    hospitalSeed({
      name: "Hoskote City Care Hospital",
      slug: "hoskote-city-care-hospital",
      city: "Hoskote",
      pincode: "562114",
      address: "KR Road, Hoskote - 562114",
      coordinates: [77.7982, 13.0707],
      phone: "+919300000101",
      email: "hoskote-care@example.com",
      specializations: ["general_physician", "pediatrics"],
      fee: 320,
      rating: { avg: 4.1, count: 49 },
    }),
    hospitalSeed({
      name: "Nelamangala Health Centre",
      slug: "nelamangala-health-centre",
      city: "Nelamangala",
      pincode: "562123",
      address: "Tumkur Road, Nelamangala - 562123",
      coordinates: [77.393, 13.102],
      phone: "+919300000102",
      email: "nelamangala-health@example.com",
      specializations: ["orthopedics", "general_physician"],
      fee: 310,
      rating: { avg: 4.0, count: 37 },
    }),
    hospitalSeed({
      name: "Ramanagara Multi Care",
      slug: "ramanagara-multi-care",
      city: "Ramanagara",
      pincode: "562159",
      address: "Bangalore Mysore Road, Ramanagara - 562159",
      coordinates: [77.2807, 12.7217],
      phone: "+919300000103",
      email: "ramanagara-care@example.com",
      specializations: ["cardiology", "ent"],
      fee: 360,
      rating: { avg: 4.2, count: 58 },
    }),
    hospitalSeed({
      name: "Hosur Family Hospital",
      slug: "hosur-family-hospital",
      city: "Hosur",
      state: "Tamil Nadu",
      pincode: "635109",
      address: "Denkanikottai Road, Hosur - 635109",
      coordinates: [77.8253, 12.7409],
      phone: "+919300000104",
      email: "hosur-family@example.com",
      specializations: ["gynecology", "pediatrics", "general_physician"],
      fee: 340,
      rating: { avg: 4.3, count: 66 },
    }),
    // ── Top-rated hospitals near [75.5417, 27.617] for top-rated API ──
    hospitalSeed({
      name: "Apollo Care Hospital",
      slug: "apollo-care-hospital",
      city: "Jhunjhunu",
      state: "Rajasthan",
      pincode: "333001",
      address: "Station Road, Jhunjhunu - 333001",
      coordinates: [75.3998, 28.1325],
      phone: "+919300001001",
      email: "apollo-care@example.com",
      specializations: ["cardiology", "neurology", "orthopedics"],
      fee: 800,
      rating: { avg: 4.9, count: 120 },
      photos: [
        { url: "https://images.unsplash.com/photo-1626315869436-d6781ba69d6e?w=800", caption: "Apollo Care Hospital", order: 0 },
        { url: "https://images.unsplash.com/photo-1551076805-e1869033e561?w=800", caption: "Emergency Wing", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Medanta Super Speciality",
      slug: "medanta-super-speciality",
      city: "Sikar",
      state: "Rajasthan",
      pincode: "332001",
      address: "Fatehpur Road, Sikar - 332001",
      coordinates: [75.1413, 27.6094],
      phone: "+919300001002",
      email: "medanta-sikar@example.com",
      specializations: ["oncology", "cardiology", "gastroenterology"],
      fee: 900,
      rating: { avg: 4.9, count: 98 },
      photos: [
        { url: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800", caption: "Medanta Building", order: 0 },
        { url: "https://images.unsplash.com/photo-1598256494821-7b31e5e74d58?w=800", caption: "OPD Area", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Fortis Prime Hospital",
      slug: "fortis-prime-hospital",
      city: "Alwar",
      state: "Rajasthan",
      pincode: "301001",
      address: "Alwar Road, Alwar - 301001",
      coordinates: [76.6346, 27.5634],
      phone: "+919300001003",
      email: "fortis-prime@example.com",
      specializations: ["neurology", "psychiatry", "general_physician"],
      fee: 750,
      rating: { avg: 4.8, count: 210 },
    }),
    hospitalSeed({
      name: "Max Wellness Centre",
      slug: "max-wellness-centre",
      city: "Nawalgarh",
      state: "Rajasthan",
      pincode: "333042",
      address: "Nawalgarh Bazaar, Nawalgarh - 333042",
      coordinates: [75.2718, 27.8549],
      phone: "+919300001004",
      email: "max-wellness@example.com",
      specializations: ["dermatology", "ophthalmology", "ent"],
      fee: 600,
      rating: { avg: 4.7, count: 85 },
    }),
    hospitalSeed({
      name: "CureWell Multispeciality",
      slug: "curewell-multispeciality",
      city: "Pilani",
      state: "Rajasthan",
      pincode: "333031",
      address: "BITS Road, Pilani - 333031",
      coordinates: [75.6037, 28.3673],
      phone: "+919300001005",
      email: "curewell-pilani@example.com",
      specializations: ["pediatrics", "gynecology", "urology"],
      fee: 550,
      rating: { avg: 4.6, count: 143 },
    }),
    hospitalSeed({
      name: "LifeLine Advanced Hospital",
      slug: "lifeline-advanced-hospital",
      city: "Chirawa",
      state: "Rajasthan",
      pincode: "333026",
      address: "Main Market Road, Chirawa - 333026",
      coordinates: [75.6417, 28.2287],
      phone: "+919300001006",
      email: "lifeline-chirawa@example.com",
      specializations: ["orthopedics", "surgery", "emergency_medicine"],
      fee: 700,
      rating: { avg: 4.5, count: 167 },
    }),
    // ── Jaipur hospitals — for frontend dev testing at lat=26.91, lng=75.74 ──
    hospitalSeed({
      name: "Sawai Man Singh Hospital",
      slug: "sawai-man-singh-hospital",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302004",
      address: "JLN Marg, Jaipur - 302004",
      coordinates: [75.8065, 26.9124],
      phone: "+919300002001",
      email: "sms@example.com",
      specializations: ["cardiology", "neurology", "orthopedics", "general_physician"],
      fee: 300,
      rating: { avg: 4.3, count: 520 },
      photos: [
        { url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800", caption: "SMS Hospital", order: 0 },
      ],
    }),
    hospitalSeed({
      name: "Fortis Escorts Hospital Jaipur",
      slug: "fortis-escorts-jaipur",
      localizedName: {
        hi: "फोर्टिस एस्कॉर्ट्स अस्पताल जयपुर",
        or: "ଫୋର୍ଟିସ ଏସ୍କର୍ଟ ହସ୍ପିଟାଲ ଜୟପୁର",
      },
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302017",
      address: "Jawahar Lal Nehru Marg, Malviya Nagar, Jaipur - 302017",
      coordinates: [75.8189, 26.8502],
      phone: "+919300002002",
      email: "fortis-jaipur@example.com",
      specializations: ["cardiology", "oncology", "neurology", "pediatrics"],
      fee: 800,
      rating: { avg: 4.7, count: 380 },
      photos: [
        { url: "https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=800", caption: "Fortis Jaipur", order: 0 },
        { url: "https://images.unsplash.com/photo-1588776814546-1ffedbe47add?w=800", caption: "ICU Wing", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Narayana Multispeciality Hospital",
      slug: "narayana-multispeciality-jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302033",
      address: "Sector 28, Pratap Nagar, Jaipur - 302033",
      coordinates: [75.7617, 26.8324],
      phone: "+919300002003",
      email: "narayana-jaipur@example.com",
      specializations: ["cardiology", "gastroenterology", "gynecology", "orthopedics"],
      fee: 600,
      rating: { avg: 4.5, count: 290 },
      photos: [
        { url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800", caption: "Narayana Jaipur", order: 0 },
      ],
    }),
    hospitalSeed({
      name: "Eternal Hospital Jaipur",
      slug: "eternal-hospital-jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302011",
      address: "JK Lon Road, Khatipura, Jaipur - 302011",
      coordinates: [75.7412, 26.9248],
      phone: "+919300002004",
      email: "eternal-jaipur@example.com",
      specializations: ["neurology", "urology", "pulmonology", "ent"],
      fee: 700,
      rating: { avg: 4.6, count: 215 },
      photos: [
        { url: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=800", caption: "Eternal Hospital", order: 0 },
      ],
    }),
    hospitalSeed({
      name: "Mahatma Gandhi Hospital",
      slug: "mahatma-gandhi-hospital-jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      address: "Sitabari, Tonk Road, Jaipur - 302001",
      coordinates: [75.7985, 26.8721],
      phone: "+919300002005",
      email: "mgh-jaipur@example.com",
      specializations: ["general_physician", "pediatrics", "dermatology", "ophthalmology"],
      fee: 250,
      rating: { avg: 4.1, count: 430 },
    }),
    hospitalSeed({
      name: "CK Birla Hospital Jaipur",
      slug: "ck-birla-hospital-jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302021",
      address: "Gopalpura Bypass, Jaipur - 302021",
      coordinates: [75.7631, 26.8955],
      phone: "+919300002006",
      email: "ckbirla-jaipur@example.com",
      specializations: ["gynecology", "pediatrics", "orthopedics", "general_physician"],
      fee: 650,
      rating: { avg: 4.8, count: 176 },
      photos: [
        { url: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800", caption: "CK Birla Jaipur", order: 0 },
        { url: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800", caption: "OPD", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "RUHS College Medical Hospital",
      slug: "ruhs-medical-hospital-jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302033",
      address: "Sector 11, Pratap Nagar, Jaipur - 302033",
      coordinates: [75.7509, 26.8213],
      phone: "+919300002007",
      email: "ruhs-jaipur@example.com",
      specializations: ["cardiology", "neurology", "orthopedics", "gastroenterology"],
      fee: 200,
      rating: { avg: 4.0, count: 610 },
    }),
    hospitalSeed({
      name: "Apex Hospital Jaipur",
      slug: "apex-hospital-jaipur",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302019",
      address: "SP-4 RIICO Industrial Area, Malviya Nagar, Jaipur - 302019",
      coordinates: [75.8318, 26.8627],
      phone: "+919300002008",
      email: "apex-jaipur@example.com",
      specializations: ["orthopedics", "dental", "ent", "dermatology"],
      fee: 450,
      rating: { avg: 4.4, count: 143 },
    }),
    // ── Kangra / Himachal Pradesh hospitals — lat: 32.14, lng: 75.98 ──
    hospitalSeed({
      name: "Tanda Medical College Hospital",
      slug: "tanda-medical-college-hospital",
      city: "Kangra",
      state: "Himachal Pradesh",
      pincode: "176001",
      address: "Dr. Rajendra Prasad Govt. Medical College, Tanda, Kangra - 176001",
      coordinates: [76.0326, 32.0866],
      phone: "+919300003001",
      email: "tanda-hospital@example.com",
      specializations: ["cardiology", "neurology", "orthopedics", "general_physician", "pediatrics"],
      fee: 150,
      rating: { avg: 4.1, count: 420 },
      photos: [
        { url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800", caption: "Tanda Hospital", order: 0 },
      ],
    }),
    hospitalSeed({
      name: "Fortis Kangra Hospital",
      slug: "fortis-kangra-hospital",
      city: "Kangra",
      state: "Himachal Pradesh",
      pincode: "176001",
      address: "Dharamshala Road, Kangra - 176001",
      coordinates: [75.9862, 32.0993],
      phone: "+919300003002",
      email: "fortis-kangra@example.com",
      specializations: ["cardiology", "oncology", "orthopedics", "gynecology"],
      fee: 600,
      rating: { avg: 4.6, count: 215 },
      photos: [
        { url: "https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=800", caption: "Fortis Kangra", order: 0 },
        { url: "https://images.unsplash.com/photo-1588776814546-1ffedbe47add?w=800", caption: "ICU Wing", order: 1 },
      ],
    }),
    hospitalSeed({
      name: "Dharamshala Civil Hospital",
      slug: "dharamshala-civil-hospital",
      city: "Dharamshala",
      state: "Himachal Pradesh",
      pincode: "176215",
      address: "McLeod Ganj Road, Dharamshala - 176215",
      coordinates: [76.3180, 32.2190],
      phone: "+919300003003",
      email: "dhm-civil@example.com",
      specializations: ["general_physician", "pediatrics", "dermatology", "ent"],
      fee: 100,
      rating: { avg: 3.9, count: 310 },
    }),
    hospitalSeed({
      name: "Palampur Multispeciality Hospital",
      slug: "palampur-multispeciality-hospital",
      city: "Palampur",
      state: "Himachal Pradesh",
      pincode: "176061",
      address: "Main Market, Palampur - 176061",
      coordinates: [76.5373, 32.1103],
      phone: "+919300003004",
      email: "palampur-hospital@example.com",
      specializations: ["orthopedics", "dental", "ophthalmology", "general_physician"],
      fee: 300,
      rating: { avg: 4.2, count: 178 },
      photos: [
        { url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800", caption: "Palampur Hospital", order: 0 },
      ],
    }),
    hospitalSeed({
      name: "Nagrota Bagwan Community Hospital",
      slug: "nagrota-bagwan-hospital",
      city: "Nagrota Bagwan",
      state: "Himachal Pradesh",
      pincode: "176047",
      address: "NH 503, Nagrota Bagwan, Kangra - 176047",
      coordinates: [76.0726, 32.1406],
      phone: "+919300003005",
      email: "nagrota-hospital@example.com",
      specializations: ["general_physician", "pediatrics", "gynecology"],
      fee: 200,
      rating: { avg: 4.0, count: 92 },
    }),
    hospitalSeed({
      name: "Kangra Valley Wellness Centre",
      slug: "kangra-valley-wellness-centre",
      city: "Kangra",
      state: "Himachal Pradesh",
      pincode: "176001",
      address: "Shahpur Road, Kangra - 176001",
      coordinates: [75.9584, 32.1142],
      phone: "+919300003006",
      email: "kv-wellness@example.com",
      specializations: ["dermatology", "ophthalmology", "ent", "dental"],
      fee: 350,
      rating: { avg: 4.3, count: 134 },
    }),
  ];

  await Promise.all(
    hospitalSeeds.map((hospital) =>
      HospitalModel.findOneAndUpdate(
        { slug: hospital.slug },
        { $set: hospital },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  return HospitalModel.find({ deletedAt: null }).sort({ createdAt: 1 });
}

async function seedDoctors(hospitals: any[]): Promise<void> {
  // Find the core hospitals by slug so we always link to the right IDs
  const slugToHospital: Record<string, any> = {};
  for (const h of hospitals) {
    slugToHospital[h.slug] = h;
  }

  const coreHospitals = [
    slugToHospital["apollo-hospitals"],
    slugToHospital["manipal-hospital"],
    slugToHospital["fortis-hospital"],
    slugToHospital["max-healthcare"],
    slugToHospital["kauvery-hospital"],
  ].filter(Boolean);

  // Kangra hospitals for local doctors
  const kangraHospitals = [
    slugToHospital["tanda-medical-college-hospital"],
    slugToHospital["fortis-kangra-hospital"],
    slugToHospital["palampur-multispeciality-hospital"],
  ].filter(Boolean);

  if (coreHospitals.length === 0) return;

  const SEEDED_REG_NUMBERS = [
    "REG001", "REG002", "REG003", "REG004", "REG005",
    "REG006", "REG007", "REG008", "REG009", "REG010",
    "REG011", "REG012", "REG013", "REG014", "REG015", "REG016",
    "REG017", "REG018", "REG019", "REG020", "REG021", "REG022",
    "REG023", "REG024",
  ];

  // Remove any stale/test doctors that are not part of the official seed set
  await DoctorModel.deleteMany({
    registrationNumber: { $nin: SEEDED_REG_NUMBERS },
    deletedAt: null,
  });

  const doctorSeeds = [
    // Apollo Hospitals doctors
    {
      name: "Dr. Rajesh Kumar",
      reg: "REG001",
      spec: "cardiology",
      hospital: coreHospitals[0],
      fee: 500,
      gender: "male",
      exp: 15,
      photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400",
    },
    {
      name: "Dr. Meena Iyer",
      reg: "REG006",
      spec: "neurology",
      hospital: coreHospitals[0],
      fee: 600,
      gender: "female",
      exp: 12,
      photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400",
    },
    {
      name: "Dr. Suresh Nair",
      reg: "REG007",
      spec: "orthopedics",
      hospital: coreHospitals[0],
      fee: 550,
      gender: "male",
      exp: 18,
      photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400",
    },
    // Manipal Hospital doctors
    {
      name: "Dr. Priya Sharma",
      reg: "REG002",
      spec: "gynecology",
      hospital: coreHospitals[1],
      fee: 400,
      gender: "female",
      exp: 10,
      photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400",
    },
    {
      name: "Dr. Kiran Desai",
      reg: "REG008",
      spec: "dental",
      hospital: coreHospitals[1],
      fee: 350,
      gender: "male",
      exp: 8,
      photo: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400",
    },
    // Fortis Hospital doctors
    {
      name: "Dr. Vikram Singh",
      reg: "REG003",
      spec: "orthopedics",
      hospital: coreHospitals[2],
      fee: 450,
      gender: "male",
      exp: 14,
      photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400",
    },
    {
      name: "Dr. Lakshmi Rao",
      reg: "REG009",
      spec: "pediatrics",
      hospital: coreHospitals[2],
      fee: 400,
      gender: "female",
      exp: 9,
      photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400",
    },
    // Max Healthcare doctors
    {
      name: "Dr. Anjali Verma",
      reg: "REG004",
      spec: "pediatrics",
      hospital: coreHospitals[3],
      fee: 350,
      gender: "female",
      exp: 12,
      photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400",
    },
    {
      name: "Dr. Rahul Mehta",
      reg: "REG010",
      spec: "ophthalmology",
      hospital: coreHospitals[3],
      fee: 500,
      gender: "male",
      exp: 11,
      photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400",
    },
    // Kauvery Hospital doctors
    {
      name: "Dr. Arun Patel",
      reg: "REG005",
      spec: "general_physician",
      hospital: coreHospitals[4],
      fee: 300,
      gender: "male",
      exp: 7,
      photo: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400",
    },
    {
      name: "Dr. Divya Nambiar",
      reg: "REG011",
      spec: "gastroenterology",
      hospital: coreHospitals[4],
      fee: 550,
      gender: "female",
      exp: 13,
      photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400",
    },
    // Doctors with varied ratings (3.0–4.2) for filter testing
    { name: "Dr. Sameer Joshi", reg: "REG012", spec: "dermatology", hospital: coreHospitals[0], fee: 400, gender: "male", exp: 5, photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400" },
    { name: "Dr. Neha Kapoor", reg: "REG013", spec: "psychiatry", hospital: coreHospitals[1], fee: 500, gender: "female", exp: 8, photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400" },
    { name: "Dr. Rohit Bansal", reg: "REG014", spec: "urology", hospital: coreHospitals[2], fee: 450, gender: "male", exp: 6, photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400" },
    { name: "Dr. Kavita Reddy", reg: "REG015", spec: "endocrinology", hospital: coreHospitals[3], fee: 600, gender: "female", exp: 11, photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400" },
    { name: "Dr. Ajay Menon", reg: "REG016", spec: "pulmonology", hospital: coreHospitals[4], fee: 350, gender: "male", exp: 4, photo: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400" },
    // ── Kangra / HP doctors ──
    { name: "Dr. Vikas Sharma",   reg: "REG017", spec: "cardiology",       hospital: kangraHospitals[0], fee: 300, gender: "male",   exp: 14, photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400", rating: { avg: 4.8, count: 210 }, languages: ["English", "Hindi", "Odia"] },
    { name: "Dr. Priya Thakur",   reg: "REG018", spec: "gynecology",       hospital: kangraHospitals[0], fee: 250, gender: "female", exp: 10, photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400", rating: { avg: 4.6, count: 175 }, languages: ["English", "Hindi", "Odia"] },
    { name: "Dr. Sunil Dogra",    reg: "REG019", spec: "orthopedics",      hospital: kangraHospitals[0], fee: 280, gender: "male",   exp: 12, photo: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400", rating: { avg: 4.2, count: 130 } },
    { name: "Dr. Anita Pathak",   reg: "REG020", spec: "pediatrics",       hospital: kangraHospitals[0], fee: 200, gender: "female", exp: 9,  photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400", rating: { avg: 3.9, count: 88 } },
    { name: "Dr. Rajesh Chandel", reg: "REG021", spec: "neurology",        hospital: kangraHospitals[1], fee: 500, gender: "male",   exp: 16, photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400", rating: { avg: 4.7, count: 260 } },
    { name: "Dr. Meenu Rana",     reg: "REG022", spec: "dermatology",      hospital: kangraHospitals[1], fee: 400, gender: "female", exp: 7,  photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400", rating: { avg: 3.5, count: 62 } },
    { name: "Dr. Harbhajan Singh",reg: "REG023", spec: "general_physician",hospital: kangraHospitals[2], fee: 200, gender: "male",   exp: 11, photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400", rating: { avg: 3.2, count: 45 } },
    { name: "Dr. Kavita Sharma",  reg: "REG024", spec: "ent",              hospital: kangraHospitals[2], fee: 350, gender: "female", exp: 8,  photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400", rating: { avg: 4.0, count: 110 } },
  ];

  for (const d of doctorSeeds) {
    if (!d.hospital) continue;
    const hospitalId = d.hospital._id;
    const hospitalName = d.hospital.name;

    await DoctorModel.findOneAndUpdate(
      { registrationNumber: d.reg },
      {
        $setOnInsert: {
          name: d.name,
          registrationNumber: d.reg,
          qualification: "MBBS, MD",
          primarySpecialization: d.spec,
          languages: (d as any).languages ?? ["English", "Hindi", "Odia"],
          experienceYears: d.exp,
          gender: d.gender,
          bio: `${d.name} is an experienced ${d.spec} specialist with ${d.exp} years of practice.`,
          photoUrl: d.photo,
          hospitalAffiliations: [
            {
              hospitalId,
              hospitalName,
              consultationFee: d.fee,
              isPrimary: true,
              joinedAt: new Date("2021-01-01"),
            },
          ],
          availability: [
            { hospitalId, dayOfWeek: "Monday", startTime: "09:00", endTime: "13:00" },
            { hospitalId, dayOfWeek: "Wednesday", startTime: "09:00", endTime: "13:00" },
            { hospitalId, dayOfWeek: "Friday", startTime: "14:00", endTime: "18:00" },
          ],
          isActive: true,
        },
        // Always update rating so varied ratings are applied on re-seed
        $set: {
          rating: (d as any).rating ?? { avg: 4.5, count: 100 },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  console.log(`Seeded ${doctorSeeds.length} doctors across core hospitals`);
}

async function seedReviews(hospitals: any[]): Promise<void> {
  const DUMMY_USER_IDS = [
    "aaaaaaaaaaaaaaaaaaaaaaaa",
    "bbbbbbbbbbbbbbbbbbbbbbbb",
    "cccccccccccccccccccccccc",
    "dddddddddddddddddddddddd",
  ];

  const hospitalReviewTemplates = [
    { rating: 5, text: "Excellent hospital! The doctors and staff were very professional and caring. I was treated with utmost respect and the facilities are top-notch. Highly recommend this hospital to everyone." },
    { rating: 4, text: "Very good experience overall. The waiting time was a bit long but the doctor was thorough and explained everything clearly. The hospital is clean and well-maintained." },
    { rating: 5, text: "Amazing experience! The emergency care was swift and the nursing staff was incredibly attentive. The treatment was effective and I recovered quickly. Thank you to the entire team!" },
    { rating: 4, text: "Good hospital with modern equipment. The doctors are experienced and the overall care was satisfactory. The pharmacy inside is well-stocked. Will visit again if needed." },
  ];

  const doctorReviewTemplates = [
    { rating: 5, text: "Dr. was extremely knowledgeable and patient. Explained the diagnosis clearly and the treatment worked wonderfully. The consultation was thorough and I felt reassured after the visit." },
    { rating: 4, text: "Very professional doctor. Listened to all my concerns and gave detailed advice. The waiting time was short and the overall experience was great. Will definitely visit again." },
    { rating: 5, text: "One of the best doctors I have ever visited. Very caring, attentive, and experienced. The diagnosis was accurate and the medication prescribed worked perfectly." },
    { rating: 4, text: "Good experience with the doctor. Friendly and easy to talk to. Gave clear instructions and follow-up was smooth. Highly recommend to family and friends." },
  ];

  // Hospital reviews
  const targetHospitals = hospitals.slice(0, 5);
  for (const hospital of targetHospitals) {
    const hospitalId = hospital._id.toString();
    for (let i = 0; i < hospitalReviewTemplates.length; i++) {
      const tpl = hospitalReviewTemplates[i];
      await ReviewModel.findOneAndUpdate(
        { userId: DUMMY_USER_IDS[i], targetId: hospitalId, targetType: "hospital" },
        {
          $setOnInsert: {
            userId: DUMMY_USER_IDS[i],
            targetId: hospitalId,
            targetType: "hospital",
            rating: tpl.rating,
            text: tpl.text,
            photos: [],
            hasBookingIntent: false,
            isFlagged: false,
            flagReasons: [],
            flagCount: 0,
            adminStatus: "approved",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  // Doctor reviews
  const doctors = await DoctorModel.find({ deletedAt: null, isActive: true }).limit(5).lean();
  for (const doctor of doctors) {
    const doctorId = (doctor._id as any).toString();
    for (let i = 0; i < doctorReviewTemplates.length; i++) {
      const tpl = doctorReviewTemplates[i];
      await ReviewModel.findOneAndUpdate(
        { userId: DUMMY_USER_IDS[i], targetId: doctorId, targetType: "doctor" },
        {
          $setOnInsert: {
            userId: DUMMY_USER_IDS[i],
            targetId: doctorId,
            targetType: "doctor",
            rating: tpl.rating,
            text: tpl.text,
            photos: [],
            hasBookingIntent: false,
            isFlagged: false,
            flagReasons: [],
            flagCount: 0,
            adminStatus: "approved",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  console.log(`Seeded reviews for ${targetHospitals.length} hospitals and ${doctors.length} doctors`);
}

async function seedBloodDonors(): Promise<void> {
  const donors = [
    // ── Jaipur donors (near lat=26.91, lng=75.74 — frontend dev test location) ──
    { name: "Arjun Sharma",   phone: "+919876100001", bloodGroup: "A+",  city: "Jaipur", pincode: "302001", coordinates: [75.7873, 26.9124] as [number,number], lastDonationDate: new Date("2024-08-15") },
    { name: "Priya Meena",    phone: "+919876100002", bloodGroup: "B+",  city: "Jaipur", pincode: "302004", coordinates: [75.8065, 26.9200] as [number,number], lastDonationDate: new Date("2024-06-01") },
    { name: "Ravi Gupta",     phone: "+919876100003", bloodGroup: "O+",  city: "Jaipur", pincode: "302017", coordinates: [75.8189, 26.8502] as [number,number], lastDonationDate: null },
    { name: "Sunita Joshi",   phone: "+919876100004", bloodGroup: "AB+", city: "Jaipur", pincode: "302011", coordinates: [75.7412, 26.9248] as [number,number], lastDonationDate: new Date("2024-10-10") },
    { name: "Deepak Verma",   phone: "+919876100005", bloodGroup: "A-",  city: "Jaipur", pincode: "302021", coordinates: [75.7631, 26.8955] as [number,number], lastDonationDate: new Date("2024-09-20") },
    { name: "Kavita Singh",   phone: "+919876100006", bloodGroup: "B-",  city: "Jaipur", pincode: "302033", coordinates: [75.7617, 26.8324] as [number,number], lastDonationDate: null },
    { name: "Mohit Agarwal",  phone: "+919876100007", bloodGroup: "O-",  city: "Jaipur", pincode: "302019", coordinates: [75.8318, 26.8627] as [number,number], lastDonationDate: new Date("2024-07-05") },
    { name: "Neha Rajput",    phone: "+919876100008", bloodGroup: "AB-", city: "Jaipur", pincode: "302033", coordinates: [75.7509, 26.8213] as [number,number], lastDonationDate: new Date("2024-11-01") },
    { name: "Rahul Yadav",    phone: "+919876100009", bloodGroup: "A+",  city: "Jaipur", pincode: "302004", coordinates: [75.7985, 26.8721] as [number,number], lastDonationDate: null },
    { name: "Anjali Khatri",  phone: "+919876100010", bloodGroup: "B+",  city: "Jaipur", pincode: "302001", coordinates: [75.7731, 26.9050] as [number,number], lastDonationDate: new Date("2024-05-14") },
    // ── Nashik donors ──
    { name: "Suresh Patil",   phone: "+919876200001", bloodGroup: "A+",  city: "Nashik", pincode: "422001", coordinates: [73.7898, 19.9975] as [number,number], lastDonationDate: new Date("2024-08-01") },
    { name: "Rekha More",     phone: "+919876200002", bloodGroup: "O+",  city: "Nashik", pincode: "422002", coordinates: [73.8012, 20.0059] as [number,number], lastDonationDate: null },
    { name: "Vijay Shinde",   phone: "+919876200003", bloodGroup: "B+",  city: "Nashik", pincode: "422003", coordinates: [73.7720, 19.9910] as [number,number], lastDonationDate: new Date("2024-09-15") },
    { name: "Lata Nikam",     phone: "+919876200004", bloodGroup: "AB+", city: "Nashik", pincode: "422001", coordinates: [73.7950, 20.0100] as [number,number], lastDonationDate: new Date("2024-07-22") },
    // ── Pune donors ──
    { name: "Amit Kulkarni",  phone: "+919876300001", bloodGroup: "A+",  city: "Pune",   pincode: "411001", coordinates: [73.8567, 18.5204] as [number,number], lastDonationDate: new Date("2024-06-10") },
    { name: "Smita Deshpande",phone: "+919876300002", bloodGroup: "B+",  city: "Pune",   pincode: "411002", coordinates: [73.8697, 18.5314] as [number,number], lastDonationDate: null },
    { name: "Nikhil Joshi",   phone: "+919876300003", bloodGroup: "O+",  city: "Pune",   pincode: "411003", coordinates: [73.8447, 18.5094] as [number,number], lastDonationDate: new Date("2024-10-01") },
    // ── Mumbai donors ──
    { name: "Rohit Shah",     phone: "+919876400001", bloodGroup: "O+",  city: "Mumbai", pincode: "400001", coordinates: [72.8777, 19.0760] as [number,number], lastDonationDate: new Date("2024-08-28") },
    { name: "Pooja Mehta",    phone: "+919876400002", bloodGroup: "A+",  city: "Mumbai", pincode: "400002", coordinates: [72.8897, 19.0870] as [number,number], lastDonationDate: null },
    // ── Delhi donors ──
    { name: "Sandeep Kumar",  phone: "+919876500001", bloodGroup: "B+",  city: "Delhi",  pincode: "110001", coordinates: [77.2090, 28.6139] as [number,number], lastDonationDate: new Date("2024-07-30") },
    { name: "Meena Chauhan",  phone: "+919876500002", bloodGroup: "O-",  city: "Delhi",  pincode: "110002", coordinates: [77.2190, 28.6239] as [number,number], lastDonationDate: null },
    { name: "Aakash Pandey",  phone: "+919876500003", bloodGroup: "AB+", city: "Delhi",  pincode: "110003", coordinates: [77.1990, 28.6039] as [number,number], lastDonationDate: new Date("2024-09-05") },
  ];

  for (const d of donors) {
    // Use insertOne-style with explicit $setOnInsert — do NOT include userId so
    // the field is absent (avoids E11000 on the userId sparse unique index when
    // multiple admin-imported donors have no linked user account).
    await BloodDonorModel.collection.findOneAndUpdate(
      { phone: d.phone },
      {
        $setOnInsert: {
          name: d.name,
          phone: d.phone,
          bloodGroup: d.bloodGroup,
          city: d.city,
          pincode: d.pincode,
          location: { type: "Point", coordinates: d.coordinates },
          lastDonationDate: d.lastDonationDate ?? null,
          lastAvailableAt: new Date(),
          isAvailable: true,
          isPhoneVerified: false,
          isVerified: false,
          eligibilitySelfDeclared: false,
          source: "admin_imported",
          contactCount: { today: 0, thisWeek: 0, total: 0 },
          rating: 0,
          complaints: 0,
          isActive: true,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  console.log(`Seeded ${donors.length} blood donors across cities`);
}

function hospitalSeed(input: {
  name: string;
  slug: string;
  city: string;
  state?: string;
  pincode: string;
  address: string;
  coordinates: [number, number];
  phone: string;
  email: string;
  specializations: string[];
  fee: number;
  rating: { avg: number; count: number };
  photos?: { url: string; caption: string; order: number }[];
  localizedName?: { hi?: string; or?: string };
}) {
  return {
    name: input.name,
    slug: input.slug,
    ...(input.localizedName
      ? { localizedName: input.localizedName }
      : HOSPITAL_LOCALIZED_NAMES[input.name]
        ? { localizedName: HOSPITAL_LOCALIZED_NAMES[input.name] }
        : {}),
    description: `${input.name} is a verified multi-specialty hospital.`,
    city: input.city,
    state: input.state ?? "Karnataka",
    pincode: input.pincode,
    country: "India",
    location: { type: "Point", coordinates: input.coordinates },
    address: input.address,
    whatsappNumber: input.phone,
    contactPhone: input.phone,
    contactEmail: input.email,
    specializations: input.specializations,
    amenities: ["ICU", "OPD", "Emergency", "Laboratory", "Pharmacy", "Parking"],
    photos: input.photos ?? [],
    timings: defaultTimings,
    holidays: [],
    acceptedInsurancePlans: [],
    startingConsultationFee: input.fee,
    rating: input.rating,
    status: "active",
    isVerified: true,
    verifiedAt: new Date("2025-01-01"),
  };
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
