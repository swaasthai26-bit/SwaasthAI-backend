export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

// ---------------------------------------------------------------------------
// State → Cities mapping
// Key  : lowercase slug used in API params  (e.g. "odisha")
// label: display name shown in the dropdown (e.g. "Odisha")
// cities: sorted list; each entry has a slug key + display label + coordinates
// ---------------------------------------------------------------------------
export interface CityEntry {
  key: string;
  label: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface StateEntry {
  key: string;
  label: string;
  cities: CityEntry[];
}

export const STATES: StateEntry[] = [
  {
    key: "odisha",
    label: "Odisha",
    cities: [
      { key: "bhubaneswar",   label: "Bhubaneswar",   coordinates: [85.8245, 20.2961] },
      { key: "cuttack",       label: "Cuttack",        coordinates: [85.8830, 20.4625] },
      { key: "rourkela",      label: "Rourkela",       coordinates: [84.8536, 22.2604] },
      { key: "berhampur",     label: "Berhampur",      coordinates: [84.7941, 19.3150] },
      { key: "sambalpur",     label: "Sambalpur",      coordinates: [83.9700, 21.4669] },
      { key: "balasore",      label: "Balasore",       coordinates: [86.9333, 21.4930] },
      { key: "baripada",      label: "Baripada",       coordinates: [86.5500, 21.9333] },
      { key: "puri",          label: "Puri",           coordinates: [85.8314, 19.8135] },
      { key: "angul",         label: "Angul",          coordinates: [85.1010, 20.8400] },
      { key: "dhenkanal",     label: "Dhenkanal",      coordinates: [85.5963, 20.6500] },
      { key: "koraput",       label: "Koraput",        coordinates: [82.7100, 18.8100] },
      { key: "jharsuguda",    label: "Jharsuguda",     coordinates: [84.0050, 21.8550] },
      { key: "kendujhar",     label: "Kendujhar",      coordinates: [85.5800, 21.6300] },
      { key: "rayagada",      label: "Rayagada",       coordinates: [83.4100, 19.1700] },
      { key: "sundargarh",    label: "Sundargarh",     coordinates: [84.0300, 22.1200] },
    ],
  },
  {
    key: "maharashtra",
    label: "Maharashtra",
    cities: [
      { key: "mumbai",        label: "Mumbai",         coordinates: [72.8777, 19.0760] },
      { key: "pune",          label: "Pune",           coordinates: [73.8567, 18.5204] },
      { key: "nagpur",        label: "Nagpur",         coordinates: [79.0882, 21.1458] },
      { key: "nashik",        label: "Nashik",         coordinates: [73.7997, 19.9975] },
      { key: "aurangabad",    label: "Aurangabad",     coordinates: [75.3433, 19.8762] },
      { key: "solapur",       label: "Solapur",        coordinates: [75.9064, 17.6805] },
      { key: "thane",         label: "Thane",          coordinates: [72.9781, 19.2183] },
      { key: "kolhapur",      label: "Kolhapur",       coordinates: [74.2433, 16.7050] },
      { key: "navi_mumbai",   label: "Navi Mumbai",    coordinates: [73.0297, 19.0330] },
      { key: "amravati",      label: "Amravati",       coordinates: [77.7523, 20.9374] },
    ],
  },
  {
    key: "west_bengal",
    label: "West Bengal",
    cities: [
      { key: "kolkata",       label: "Kolkata",        coordinates: [88.3639, 22.5726] },
      { key: "howrah",        label: "Howrah",         coordinates: [88.3188, 22.5958] },
      { key: "durgapur",      label: "Durgapur",       coordinates: [87.3119, 23.5204] },
      { key: "asansol",       label: "Asansol",        coordinates: [86.9661, 23.6889] },
      { key: "siliguri",      label: "Siliguri",       coordinates: [88.4272, 26.7271] },
      { key: "bardhaman",     label: "Bardhaman",      coordinates: [87.8615, 23.2324] },
      { key: "malda",         label: "Malda",          coordinates: [88.1415, 25.0108] },
      { key: "kharagpur",     label: "Kharagpur",      coordinates: [87.3319, 22.3460] },
    ],
  },
  {
    key: "karnataka",
    label: "Karnataka",
    cities: [
      { key: "bangalore",     label: "Bangalore",      coordinates: [77.5946, 12.9716] },
      { key: "mysore",        label: "Mysore",         coordinates: [76.6394, 12.2958] },
      { key: "hubli",         label: "Hubli",          coordinates: [75.1240, 15.3647] },
      { key: "mangalore",     label: "Mangalore",      coordinates: [74.8560, 12.9141] },
      { key: "belgaum",       label: "Belgaum",        coordinates: [74.4977, 15.8497] },
      { key: "gulbarga",      label: "Gulbarga",       coordinates: [76.8237, 17.3297] },
      { key: "davangere",     label: "Davangere",      coordinates: [75.9238, 14.4644] },
      { key: "bellary",       label: "Bellary",        coordinates: [76.9214, 15.1394] },
    ],
  },
  {
    key: "tamil_nadu",
    label: "Tamil Nadu",
    cities: [
      { key: "chennai",       label: "Chennai",        coordinates: [80.2707, 13.0827] },
      { key: "coimbatore",    label: "Coimbatore",     coordinates: [76.9558, 11.0168] },
      { key: "madurai",       label: "Madurai",        coordinates: [78.1198, 9.9252]  },
      { key: "trichy",        label: "Trichy",         coordinates: [78.6866, 10.7905] },
      { key: "salem",         label: "Salem",          coordinates: [78.1460, 11.6643] },
      { key: "tirunelveli",   label: "Tirunelveli",    coordinates: [77.6960, 8.7139]  },
      { key: "vellore",       label: "Vellore",        coordinates: [79.1325, 12.9165] },
      { key: "erode",         label: "Erode",          coordinates: [77.7172, 11.3410] },
    ],
  },
  {
    key: "telangana",
    label: "Telangana",
    cities: [
      { key: "hyderabad",     label: "Hyderabad",      coordinates: [78.4867, 17.3850] },
      { key: "warangal",      label: "Warangal",       coordinates: [79.5941, 17.9784] },
      { key: "nizamabad",     label: "Nizamabad",      coordinates: [78.0941, 18.6725] },
      { key: "karimnagar",    label: "Karimnagar",     coordinates: [79.1288, 18.4386] },
      { key: "khammam",       label: "Khammam",        coordinates: [80.1514, 17.2473] },
      { key: "ramagundam",    label: "Ramagundam",     coordinates: [79.4737, 18.7558] },
    ],
  },
  {
    key: "delhi",
    label: "Delhi",
    cities: [
      { key: "new_delhi",     label: "New Delhi",      coordinates: [77.2090, 28.6139] },
      { key: "delhi",         label: "Delhi",          coordinates: [77.1025, 28.7041] },
      { key: "dwarka",        label: "Dwarka",         coordinates: [77.0589, 28.5921] },
      { key: "rohini",        label: "Rohini",         coordinates: [77.1151, 28.7495] },
      { key: "noida",         label: "Noida",          coordinates: [77.3910, 28.5355] },
    ],
  },
  {
    key: "uttar_pradesh",
    label: "Uttar Pradesh",
    cities: [
      { key: "lucknow",       label: "Lucknow",        coordinates: [80.9462, 26.8467] },
      { key: "kanpur",        label: "Kanpur",         coordinates: [80.3319, 26.4499] },
      { key: "agra",          label: "Agra",           coordinates: [78.0081, 27.1767] },
      { key: "varanasi",      label: "Varanasi",       coordinates: [82.9739, 25.3176] },
      { key: "allahabad",     label: "Allahabad",      coordinates: [81.8463, 25.4358] },
      { key: "meerut",        label: "Meerut",         coordinates: [77.7064, 28.9845] },
      { key: "ghaziabad",     label: "Ghaziabad",      coordinates: [77.4538, 28.6692] },
      { key: "bareilly",      label: "Bareilly",       coordinates: [79.4304, 28.3670] },
    ],
  },
  {
    key: "rajasthan",
    label: "Rajasthan",
    cities: [
      { key: "jaipur",        label: "Jaipur",         coordinates: [75.7873, 26.9124] },
      { key: "jodhpur",       label: "Jodhpur",        coordinates: [73.0243, 26.2389] },
      { key: "udaipur",       label: "Udaipur",        coordinates: [73.7125, 24.5854] },
      { key: "kota",          label: "Kota",           coordinates: [75.8648, 25.2138] },
      { key: "ajmer",         label: "Ajmer",          coordinates: [74.6399, 26.4499] },
      { key: "bikaner",       label: "Bikaner",        coordinates: [73.3119, 28.0229] },
      { key: "alwar",         label: "Alwar",          coordinates: [76.6346, 27.5530] },
    ],
  },
  {
    key: "gujarat",
    label: "Gujarat",
    cities: [
      { key: "ahmedabad",     label: "Ahmedabad",      coordinates: [72.5714, 23.0225] },
      { key: "surat",         label: "Surat",          coordinates: [72.8311, 21.1702] },
      { key: "vadodara",      label: "Vadodara",       coordinates: [73.1812, 22.3072] },
      { key: "rajkot",        label: "Rajkot",         coordinates: [70.8022, 22.3039] },
      { key: "bhavnagar",     label: "Bhavnagar",      coordinates: [72.1519, 21.7645] },
      { key: "jamnagar",      label: "Jamnagar",       coordinates: [70.0577, 22.4707] },
      { key: "gandhinagar",   label: "Gandhinagar",    coordinates: [72.6369, 23.2156] },
    ],
  },
  {
    key: "bihar",
    label: "Bihar",
    cities: [
      { key: "patna",         label: "Patna",          coordinates: [85.1376, 25.5941] },
      { key: "gaya",          label: "Gaya",           coordinates: [84.9994, 24.7955] },
      { key: "bhagalpur",     label: "Bhagalpur",      coordinates: [87.0000, 25.2425] },
      { key: "muzaffarpur",   label: "Muzaffarpur",    coordinates: [85.3680, 26.1209] },
      { key: "darbhanga",     label: "Darbhanga",      coordinates: [85.8960, 26.1522] },
      { key: "purnia",        label: "Purnia",         coordinates: [87.4753, 25.7771] },
      { key: "arrah",         label: "Arrah",          coordinates: [84.6630, 25.5560] },
    ],
  },
  {
    key: "madhya_pradesh",
    label: "Madhya Pradesh",
    cities: [
      { key: "bhopal",        label: "Bhopal",         coordinates: [77.4126, 23.2599] },
      { key: "indore",        label: "Indore",         coordinates: [75.8577, 22.7196] },
      { key: "jabalpur",      label: "Jabalpur",       coordinates: [79.9864, 23.1815] },
      { key: "gwalior",       label: "Gwalior",        coordinates: [78.1828, 26.2183] },
      { key: "ujjain",        label: "Ujjain",         coordinates: [75.7849, 23.1765] },
      { key: "sagar",         label: "Sagar",          coordinates: [78.7378, 23.8388] },
      { key: "rewa",          label: "Rewa",           coordinates: [81.2962, 24.5362] },
    ],
  },
  {
    key: "andhra_pradesh",
    label: "Andhra Pradesh",
    cities: [
      { key: "visakhapatnam", label: "Visakhapatnam",  coordinates: [83.2185, 17.6868] },
      { key: "vijayawada",    label: "Vijayawada",     coordinates: [80.6480, 16.5062] },
      { key: "guntur",        label: "Guntur",         coordinates: [80.4428, 16.3067] },
      { key: "nellore",       label: "Nellore",        coordinates: [79.9865, 14.4426] },
      { key: "kurnool",       label: "Kurnool",        coordinates: [78.0373, 15.8281] },
      { key: "tirupati",      label: "Tirupati",       coordinates: [79.4192, 13.6288] },
      { key: "rajahmundry",   label: "Rajahmundry",    coordinates: [81.7840, 17.0005] },
    ],
  },
  {
    key: "punjab",
    label: "Punjab",
    cities: [
      { key: "ludhiana",      label: "Ludhiana",       coordinates: [75.8573, 30.9010] },
      { key: "amritsar",      label: "Amritsar",       coordinates: [74.8723, 31.6340] },
      { key: "jalandhar",     label: "Jalandhar",      coordinates: [75.5762, 31.3260] },
      { key: "patiala",       label: "Patiala",        coordinates: [76.3869, 30.3398] },
      { key: "bathinda",      label: "Bathinda",       coordinates: [74.9455, 30.2110] },
      { key: "mohali",        label: "Mohali",         coordinates: [76.7179, 30.7046] },
    ],
  },
  {
    key: "haryana",
    label: "Haryana",
    cities: [
      { key: "faridabad",     label: "Faridabad",      coordinates: [77.3178, 28.4089] },
      { key: "gurgaon",       label: "Gurgaon",        coordinates: [77.0266, 28.4595] },
      { key: "rohtak",        label: "Rohtak",         coordinates: [76.6066, 28.8955] },
      { key: "hisar",         label: "Hisar",          coordinates: [75.7218, 29.1492] },
      { key: "panipat",       label: "Panipat",        coordinates: [76.9635, 29.3909] },
      { key: "ambala",        label: "Ambala",         coordinates: [76.7767, 30.3752] },
    ],
  },
  {
    key: "kerala",
    label: "Kerala",
    cities: [
      { key: "thiruvananthapuram", label: "Thiruvananthapuram", coordinates: [76.9366, 8.5241] },
      { key: "kochi",         label: "Kochi",          coordinates: [76.2673, 9.9312]  },
      { key: "kozhikode",     label: "Kozhikode",      coordinates: [75.7804, 11.2588] },
      { key: "thrissur",      label: "Thrissur",       coordinates: [76.2144, 10.5276] },
      { key: "kollam",        label: "Kollam",         coordinates: [76.6141, 8.8932]  },
      { key: "palakkad",      label: "Palakkad",       coordinates: [76.6548, 10.7867] },
    ],
  },
  {
    key: "jharkhand",
    label: "Jharkhand",
    cities: [
      { key: "ranchi",        label: "Ranchi",         coordinates: [85.3096, 23.3441] },
      { key: "jamshedpur",    label: "Jamshedpur",     coordinates: [86.2029, 22.8046] },
      { key: "dhanbad",       label: "Dhanbad",        coordinates: [86.4304, 23.7957] },
      { key: "bokaro",        label: "Bokaro",         coordinates: [86.1511, 23.6693] },
      { key: "deoghar",       label: "Deoghar",        coordinates: [86.6950, 24.4853] },
      { key: "hazaribagh",    label: "Hazaribagh",     coordinates: [85.3636, 23.9963] },
    ],
  },
  {
    key: "chhattisgarh",
    label: "Chhattisgarh",
    cities: [
      { key: "raipur",        label: "Raipur",         coordinates: [81.6296, 21.2514] },
      { key: "bhilai",        label: "Bhilai",         coordinates: [81.4285, 21.1938] },
      { key: "bilaspur",      label: "Bilaspur",       coordinates: [82.1391, 22.0797] },
      { key: "korba",         label: "Korba",          coordinates: [82.6980, 22.3595] },
      { key: "durg",          label: "Durg",           coordinates: [81.2849, 21.1904] },
    ],
  },
  {
    key: "assam",
    label: "Assam",
    cities: [
      { key: "guwahati",      label: "Guwahati",       coordinates: [91.7362, 26.1445] },
      { key: "dibrugarh",     label: "Dibrugarh",      coordinates: [94.9120, 27.4728] },
      { key: "silchar",       label: "Silchar",        coordinates: [92.7789, 24.8333] },
      { key: "jorhat",        label: "Jorhat",         coordinates: [94.2026, 26.7509] },
      { key: "nagaon",        label: "Nagaon",         coordinates: [92.6840, 26.3464] },
    ],
  },
  {
    key: "uttarakhand",
    label: "Uttarakhand",
    cities: [
      { key: "dehradun",      label: "Dehradun",       coordinates: [78.0322, 30.3165] },
      { key: "haridwar",      label: "Haridwar",       coordinates: [78.1642, 29.9457] },
      { key: "roorkee",       label: "Roorkee",        coordinates: [77.8881, 29.8543] },
      { key: "haldwani",      label: "Haldwani",       coordinates: [79.5130, 29.2183] },
      { key: "nainital",      label: "Nainital",       coordinates: [79.4637, 29.3919] },
    ],
  },
  {
    key: "himachal_pradesh",
    label: "Himachal Pradesh",
    cities: [
      { key: "shimla",        label: "Shimla",         coordinates: [77.1734, 31.1048] },
      { key: "manali",        label: "Manali",         coordinates: [77.1892, 32.2396] },
      { key: "dharamshala",   label: "Dharamshala",    coordinates: [76.3234, 32.2190] },
      { key: "solan",         label: "Solan",          coordinates: [77.0964, 30.9045] },
      { key: "mandi",         label: "Mandi",          coordinates: [76.9318, 31.7090] },
    ],
  },
];

// Build a flat lookup map: city key → coordinates (merges all states)
// Also keeps the existing CITY_COORDINATES populated for backward compatibility
export const CITY_COORDINATES: Record<string, [number, number]> = {
  bangalore: [77.5946, 12.9716],
  bengaluru: [77.5946, 12.9716],
  mumbai: [72.8777, 19.076],
  pune: [73.8567, 18.5204],
  nashik: [73.7997, 19.9975],
  delhi: [77.1025, 28.7041],
  patna: [85.1376, 25.5941],
  hyderabad: [78.4867, 17.385],
  chennai: [80.2707, 13.0827],
  kolkata: [88.3639, 22.5726],
  ahmedabad: [72.5714, 23.0225],
  jaipur: [75.7873, 26.9124],
  lucknow: [80.9462, 26.8467],
  bhubaneswar: [85.8245, 20.2961],
};

// Merge every city from STATES into CITY_COORDINATES so existing lookups still work
for (const state of STATES) {
  for (const city of state.cities) {
    if (!CITY_COORDINATES[city.key]) {
      CITY_COORDINATES[city.key] = city.coordinates;
    }
  }
}

// Quick state lookup by key
export const STATE_MAP: Map<string, StateEntry> = new Map(
  STATES.map((s) => [s.key, s]),
);

export function autocompletePlaces(query: string) {
  const normalized = query.trim().toLowerCase();
  return Object.entries(CITY_COORDINATES)
    .filter(([city]) => city.includes(normalized))
    .slice(0, 10)
    .map(([city, coordinates]) => ({
      label: toTitleCase(city),
      city: toTitleCase(city),
      country: "India",
      location: { type: "Point" as const, coordinates },
    }));
}

export function reverseGeoPoint(lat: number, lng: number) {
  const origin: [number, number] = [lng, lat];
  const nearest = Object.entries(CITY_COORDINATES)
    .map(([city, coordinates]) => ({
      city,
      coordinates,
      distanceKm: distanceKm(origin, coordinates),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (!nearest) return null;

  return {
    label: `${toTitleCase(nearest.city)}, India`,
    city: toTitleCase(nearest.city),
    country: "India",
    distanceKm: nearest.distanceKm,
    location: { type: "Point" as const, coordinates: nearest.coordinates },
  };
}

export function resolveGeoPoint(input: {
  lat?: number;
  lng?: number;
  city?: string;
  pincode?: string;
}): GeoPoint | null {
  if (input.lat !== undefined && input.lng !== undefined) {
    return { type: "Point", coordinates: [input.lng, input.lat] };
  }

  if (input.city) {
    const coordinates = CITY_COORDINATES[input.city.trim().toLowerCase()];
    if (coordinates) return { type: "Point", coordinates };
  }

  if (input.pincode) {
    return { type: "Point", coordinates: approximatePincode(input.pincode) };
  }

  return null;
}

export function distanceKm(from: [number, number], to: [number, number]): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

function approximatePincode(pincode: string): [number, number] {
  const seed = Number(pincode.slice(0, 3));
  return [68 + (seed % 30) * 0.35, 8 + (seed % 60) * 0.35];
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
