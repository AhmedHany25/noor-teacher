/** Countries the teacher's students commonly live in: time zone, Arabic name, WhatsApp dial code. */
export type Country = { timeZone: string; name: string; dialCode: string }

export const COUNTRIES: Country[] = [
  { timeZone: 'Africa/Cairo', name: 'مصر', dialCode: '20' },
  { timeZone: 'Asia/Riyadh', name: 'السعودية', dialCode: '966' },
  { timeZone: 'Asia/Dubai', name: 'الإمارات', dialCode: '971' },
  { timeZone: 'Asia/Kuwait', name: 'الكويت', dialCode: '965' },
  { timeZone: 'Asia/Qatar', name: 'قطر', dialCode: '974' },
  { timeZone: 'Asia/Bahrain', name: 'البحرين', dialCode: '973' },
  { timeZone: 'Asia/Muscat', name: 'عُمان', dialCode: '968' },
  { timeZone: 'Asia/Baghdad', name: 'العراق', dialCode: '964' },
  { timeZone: 'Asia/Amman', name: 'الأردن', dialCode: '962' },
  { timeZone: 'Asia/Gaza', name: 'فلسطين', dialCode: '970' },
  { timeZone: 'Asia/Damascus', name: 'سوريا', dialCode: '963' },
  { timeZone: 'Asia/Beirut', name: 'لبنان', dialCode: '961' },
  { timeZone: 'Asia/Aden', name: 'اليمن', dialCode: '967' },
  { timeZone: 'Africa/Khartoum', name: 'السودان', dialCode: '249' },
  { timeZone: 'Africa/Tripoli', name: 'ليبيا', dialCode: '218' },
  { timeZone: 'Africa/Tunis', name: 'تونس', dialCode: '216' },
  { timeZone: 'Africa/Algiers', name: 'الجزائر', dialCode: '213' },
  { timeZone: 'Africa/Casablanca', name: 'المغرب', dialCode: '212' },
  { timeZone: 'Europe/Istanbul', name: 'تركيا', dialCode: '90' },
  { timeZone: 'Europe/London', name: 'بريطانيا', dialCode: '44' },
  { timeZone: 'Europe/Paris', name: 'فرنسا', dialCode: '33' },
  { timeZone: 'Europe/Berlin', name: 'ألمانيا', dialCode: '49' },
  { timeZone: 'Europe/Stockholm', name: 'السويد', dialCode: '46' },
  { timeZone: 'Europe/Amsterdam', name: 'هولندا', dialCode: '31' },
  { timeZone: 'America/New_York', name: 'أمريكا (نيويورك)', dialCode: '1' },
  { timeZone: 'America/Chicago', name: 'أمريكا (شيكاغو)', dialCode: '1' },
  { timeZone: 'America/Los_Angeles', name: 'أمريكا (لوس أنجلوس)', dialCode: '1' },
  { timeZone: 'America/Toronto', name: 'كندا (تورنتو)', dialCode: '1' },
  { timeZone: 'Australia/Sydney', name: 'أستراليا (سيدني)', dialCode: '61' },
  { timeZone: 'Asia/Kuala_Lumpur', name: 'ماليزيا', dialCode: '60' },
  { timeZone: 'Asia/Jakarta', name: 'إندونيسيا', dialCode: '62' },
  { timeZone: 'Asia/Karachi', name: 'باكستان', dialCode: '92' },
]

export const DEFAULT_TIME_ZONE = 'Africa/Cairo'

export function countryOf(timeZone: string | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.timeZone === timeZone)
}
