/**
 * Lightweight i18n สำหรับ Basket Bos (ไทย/อังกฤษ)
 *  - ภาษาไทยเป็น source of truth; อังกฤษต้องมีคีย์ครบเท่ากัน (บังคับด้วย type)
 *  - ใช้ผ่าน t(lang, "key") ในทั้ง server + client components
 */
export type Lang = "th" | "en";

const th = {
  // แถบเมนูล่าง
  "nav.home": "หน้าแรก",
  "nav.games": "เกม",
  "nav.groups": "ก๊วน",
  "nav.leaderboard": "อันดับ",
  "nav.profile": "โปรไฟล์",

  // ทั่วไป
  "common.save": "บันทึก",
  "common.saving": "กำลังบันทึก...",
  "common.saved": "บันทึกแล้ว",
  "common.cancel": "ยกเลิก",
  "common.back": "กลับ",

  // โปรไฟล์
  "profile.title": "โปรไฟล์",
  "profile.settings": "ตั้งค่า",
  "profile.height": "ส่วนสูง",
  "profile.weight": "น้ำหนัก",
  "profile.birthYear": "ปีเกิด",
  "profile.hand": "มือที่ถนัด",
  "profile.positions": "ตำแหน่ง",
  "profile.admin": "ผู้ดูแลก๊วน",
  "profile.player": "ผู้เล่น",
  "profile.myCard": "ดูการ์ด & สถิติของฉัน",
  "profile.cardPhoto": "รูปการ์ดนักบาส",
  "profile.athleteInfo": "ข้อมูลนักกีฬา",
  "profile.bioTitle": "ประวัติการเล่น",
  "profile.cm": "ซม.",
  "profile.kg": "กก.",

  // ตั้งค่า
  "settings.title": "ตั้งค่า",
  "settings.jerseyName": "ชื่อบนเสื้อ",
  "settings.jerseyHint": "ชื่อนี้จะโชว์ในแอปทุกที่ — เปลี่ยนเมื่อไหร่ก็ได้",
  "settings.jerseyPlaceholder": "เช่น บอส, BOSS, 23",
  "settings.language": "ภาษา",
  "settings.langTh": "ไทย",
  "settings.langEn": "English",
  "settings.nameRequired": "กรุณาใส่ชื่อบนเสื้อ",

  // Onboarding
  "onboard.jerseyName": "ชื่อบนเสื้อ (ที่โชว์ในแอป)",
  "onboard.jerseyHint": "ตั้งชื่อที่อยากให้คนอื่นเห็น เปลี่ยนได้ตลอดในหน้าตั้งค่า",

  // แดชบอร์ด
  "dash.hello": "สวัสดี",
  "dash.upcoming": "เกมที่จะถึง",
  "dash.noGames": "ยังไม่มีเกม",
} as const;

type Dict = Record<keyof typeof th, string>;

const en: Dict = {
  "nav.home": "Home",
  "nav.games": "Games",
  "nav.groups": "Groups",
  "nav.leaderboard": "Ranking",
  "nav.profile": "Profile",

  "common.save": "Save",
  "common.saving": "Saving...",
  "common.saved": "Saved",
  "common.cancel": "Cancel",
  "common.back": "Back",

  "profile.title": "Profile",
  "profile.settings": "Settings",
  "profile.height": "Height",
  "profile.weight": "Weight",
  "profile.birthYear": "Birth year",
  "profile.hand": "Dominant hand",
  "profile.positions": "Positions",
  "profile.admin": "Group admin",
  "profile.player": "Player",
  "profile.myCard": "View my card & stats",
  "profile.cardPhoto": "Player card photo",
  "profile.athleteInfo": "Athlete info",
  "profile.bioTitle": "Playing history",
  "profile.cm": "cm",
  "profile.kg": "kg",

  "settings.title": "Settings",
  "settings.jerseyName": "Jersey name",
  "settings.jerseyHint": "This name shows everywhere in the app — change it anytime",
  "settings.jerseyPlaceholder": "e.g. Boss, BOSS, 23",
  "settings.language": "Language",
  "settings.langTh": "ไทย",
  "settings.langEn": "English",
  "settings.nameRequired": "Please enter a jersey name",

  "onboard.jerseyName": "Jersey name (shown in app)",
  "onboard.jerseyHint": "Pick the name others will see — change it anytime in settings",

  "dash.hello": "Hi",
  "dash.upcoming": "Upcoming games",
  "dash.noGames": "No games yet",
};

const dict: Record<Lang, Dict> = { th, en };

export type I18nKey = keyof typeof th;

export function t(lang: Lang, key: I18nKey): string {
  return dict[lang]?.[key] ?? th[key] ?? key;
}
