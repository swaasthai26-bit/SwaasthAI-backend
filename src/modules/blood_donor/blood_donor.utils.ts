import type { BloodDonorDocument, GeoLocation, PublicDonorSummary } from "./blood_donor.interface";
import { DONOR_ELIGIBILITY_DAYS } from "./blood_donor.constants";

const CITY_COORDS: Record<string, [number, number]> = {
  nashik: [73.7997, 19.9975],
  pune: [73.8567, 18.5204],
  mumbai: [72.8777, 19.076],
  patna: [85.1376, 25.5941],
  delhi: [77.1025, 28.7041],
  bengaluru: [77.5946, 12.9716],
  bangalore: [77.5946, 12.9716],
  hyderabad: [78.4867, 17.385],
  chennai: [80.2707, 13.0827],
  kolkata: [88.3639, 22.5726],
};

export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Donor";
}

export function geocodeIndianLocation(city?: string, pincode?: string): GeoLocation {
  const coords = city ? CITY_COORDS[city.trim().toLowerCase()] : undefined;
  return {
    type: "Point",
    coordinates: coords ?? pincodeToApproxCoordinates(pincode),
  };
}

function pincodeToApproxCoordinates(pincode?: string): [number, number] {
  if (!pincode) return [73.7997, 19.9975];
  const seed = Number(pincode.slice(0, 3));
  return [68 + (seed % 30) * 0.35, 8 + (seed % 60) * 0.35];
}

export function distanceKm(from: [number, number], to: [number, number]): number {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Number((earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

export function daysSince(date?: Date | null): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
}

export function toPublicDonor(
  donor: BloodDonorDocument,
  origin?: [number, number],
): PublicDonorSummary {
  const donationDays = daysSince(donor.lastDonationDate);
  return {
    id: donor._id.toString(),
    firstName: firstName(donor.name), // first name only for privacy
    bloodGroup: donor.bloodGroup,
    city: donor.city,
    lastDonationDate: donor.lastDonationDate ?? null,
    lastAvailableAt: donor.lastAvailableAt ?? donor.updatedAt,
    daysSinceLastDonation: donationDays,
    mayBeEligible: donationDays === null || donationDays >= DONOR_ELIGIBILITY_DAYS,
    distanceKm: origin ? distanceKm(origin, donor.location.coordinates) : undefined,
    isVerified: donor.isVerified,
    isAvailable: donor.isAvailable,
  };
}

export function buildDonorWhatsAppMessage(
  bloodGroup: string,
  city: string,
  requesterFirstName: string,
  needFor = "family member",
): string {
  return `Hi, I found you via the SwaasthAI app. I urgently need ${bloodGroup} blood for ${needFor} in ${city}. Are you available to donate? - ${requesterFirstName}`;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = normalizeIndianPhone(phone).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function parseCsvRows(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}
