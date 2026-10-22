export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export const DONOR_CONTACT_DAILY_LIMIT = 3;
export const DONOR_ELIGIBILITY_DAYS = 90;

export const DONOR_CONTACT_RATE_KEY = (donorId: string, date: string) =>
  `rl:donor_contact:${donorId}:${date}`;
