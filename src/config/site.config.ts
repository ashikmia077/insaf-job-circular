export const siteConfig = {
  name: "Insaf Job Circular",
  shortName: "Insaf Jobs",
  bengaliName: "ইনসাফ জব সার্কুলার",
  description:
    "Bangladesh's verified job circular platform featuring official government, bank, autonomous, NGO, and private sector notices with AI-assisted extraction and human/cryptographic source verification.",
  sponsorBrand: {
    name: "Insaf Computer",
    tagline: "Online Job Application, Compose, Printing & Digital Service Center",
  },
  locale: "bn-BD",
  timezone: "Asia/Dhaka",
  categories: [
    { slug: "government", labelEn: "Government Jobs", labelBn: "সরকারি চাকরি" },
    { slug: "bank", labelEn: "Bank & Financial", labelBn: "ব্যাংক ও আর্থিক প্রতিষ্ঠান" },
    { slug: "autonomous", labelEn: "Autonomous Bodies", labelBn: "স্বায়ত্তশাসিত প্রতিষ্ঠান" },
    { slug: "defense", labelEn: "Defense & Forces", labelBn: "প্রতিরক্ষা ও বাহিনী" },
    { slug: "ngo", labelEn: "NGO & Development", labelBn: "এনজিও ও উন্নয়ন সংস্থা" },
    { slug: "private", labelEn: "Private & Corporate", labelBn: "বেসরকারি ও কর্পোরেট" },
    { slug: "education", labelEn: "Teacher & Education", labelBn: "শিক্ষক ও শিক্ষা প্রতিষ্ঠান" },
  ] as const,
} as const;

export type SiteConfig = typeof siteConfig;
