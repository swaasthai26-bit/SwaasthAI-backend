export interface Specialization {
  key: string;
  label: string;
  iconKey: string;
  imageUrl?: string;
}

export const SPECIALIZATIONS: Specialization[] = [
  { key: "cardiology", label: "Cardiology", iconKey: "heart" },
  { key: "neurology", label: "Neurology", iconKey: "brain" },
  { key: "orthopedics", label: "Orthopedics", iconKey: "bone" },
  { key: "pediatrics", label: "Pediatrics", iconKey: "baby" },
  { key: "dermatology", label: "Dermatology", iconKey: "skin" },
  { key: "gynecology", label: "Gynecology", iconKey: "female" },
  { key: "oncology", label: "Oncology", iconKey: "cancer" },
  { key: "urology", label: "Urology", iconKey: "kidney" },
  { key: "gastroenterology", label: "Gastroenterology", iconKey: "stomach" },
  { key: "pulmonology", label: "Pulmonology", iconKey: "lungs" },
  { key: "nephrology", label: "Nephrology", iconKey: "kidney" },
  { key: "hepatology", label: "Hepatology", iconKey: "liver" },
  { key: "rheumatology", label: "Rheumatology", iconKey: "joints" },
  { key: "endocrinology", label: "Endocrinology", iconKey: "hormone" },
  { key: "psychiatry", label: "Psychiatry", iconKey: "mind" },
  { key: "dental", label: "Dental", iconKey: "tooth" },
  { key: "ent", label: "ENT (Ear, Nose, Throat)", iconKey: "ear" },
  { key: "ophthalmology", label: "Ophthalmology", iconKey: "eye" },
  { key: "general_physician", label: "General Physician", iconKey: "doctor" },
  {
    key: "emergency_medicine",
    label: "Emergency Medicine",
    iconKey: "ambulance",
  },
  { key: "physical_therapy", label: "Physical Therapy", iconKey: "therapy" },
  { key: "radiology", label: "Radiology", iconKey: "xray" },
  { key: "pathology", label: "Pathology", iconKey: "microscope" },
  { key: "anesthesiology", label: "Anesthesiology", iconKey: "injection" },
  { key: "surgery", label: "Surgery", iconKey: "surgery" },
];

export const SPECIALIZATION_KEYS = SPECIALIZATIONS.map((s) => s.key);
