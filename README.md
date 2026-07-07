# 🏀 Basket Bos

Web app จัดการก๊วนบาส — จองคิวลงเล่น, จัดทีมแฟร์ๆ, จ่ายค่าสนามด้วย PromptPay QR และเก็บสถิติแบบ NBA (พร้อมโครงสร้างรองรับ AI video analysis)

เอกสารทั้งหมดอยู่ใน [`docs/`](./docs) — PRD, Architecture, Database, Roadmap

## สถานะปัจจุบัน: MVP ครบทุก Milestone (M1–M9) พร้อม Deploy 🚀

ดูขั้นตอนเอาขึ้นใช้จริงใน [`DEPLOY.md`](./DEPLOY.md)


- ✅ M1: Next.js 15 + Tailwind + LINE Login + onboarding + database เต็มระบบ (RLS + race-safe queue)
- ✅ M2: สร้าง/แก้ไข/จัดการเกม (แอดมิน), หน้ารายการเกม, lifecycle
- ✅ M3: ลงชื่อ/ถอนตัวปุ่มเดียว (FCFS), คิวสำรอง auto-promote, roster สดผ่าน Realtime, แอดมินเพิ่ม/เอาคนออก, แจ้งเตือนในแอป
- ✅ M4: PromptPay QR ระบุยอดต่อคนอัตโนมัติ, แจ้งโอน + แนบสลิป, dashboard จ่ายแล้ว/ยังไม่จ่ายแบบ realtime, ยอดค้างจ่ายบนหน้าแรก
- ✅ M5: จัดทีมยุติธรรมอัตโนมัติ (snake draft + optimization จากฝีมือ/ส่วนสูง/น้ำหนัก/ตำแหน่ง), สุ่มใหม่ได้, แตะสลับตัว, ล็อคทีม
- ✅ M6: บันทึกสถิติข้างสนามแบบแตะเร็ว (2PT/3PT/FT/AST/REB/STL/BLK/TO + MVP + undo), OVR rating + tier (Rookie→Starter→All-Star→Legend), การ์ดนักบาสแชร์เป็นรูป PNG เข้า LINE/IG, leaderboard, หน้าโปรไฟล์นักกีฬา, รูปการ์ดอัพเองหรือให้ AI แต่ง (ต้องใส่ `OPENAI_API_KEY`)
- ✅ M7: อัพโหลดวิดีโอเกม (สูงสุด 1GB), เล่นในแอปผ่าน signed URL, สร้างคิววิเคราะห์ AI อัตโนมัติ (พร้อมสำหรับ Phase 3)
- ✅ M8: LINE push — เปิดรับสมัครเกมใหม่, เลื่อนจากคิวสำรอง, ประกาศทีม, เตือนค่าสนาม + webhook ต้อนรับเพื่อนใหม่
- ✅ M9: loading/error/404 pages + คู่มือ deploy (`DEPLOY.md`)
- ค่าเริ่มต้นก๊วน: **20 คน / สำรอง 5 / 4 ทีม**

> ตั้งค่า `PROMPTPAY_ID` ใน `.env.local` (เบอร์มือถือหรือเลขบัตรประชาชนของคนรับเงิน)

> ⚠️ อย่าลืมรัน migration ทุกไฟล์ใน `db/migrations/` ตามลำดับ (001, 002, ...)

## วิธีติดตั้ง

### 1. สร้าง Supabase project (ฟรี)

1. ไปที่ [supabase.com](https://supabase.com) → New project
2. เปิด **SQL Editor** → วางเนื้อหาไฟล์ `db/migrations/001_init.sql` → Run
3. จด `Project URL`, `anon key`, `service_role key` จาก Settings → API

### 2. สร้าง LINE Login channel (ฟรี)

1. ไปที่ [developers.line.biz](https://developers.line.biz) → สร้าง Provider → สร้าง Channel ชนิด **LINE Login**
2. ใน Channel settings ใส่ Callback URL: `http://localhost:3000/auth/callback` (และ URL จริงตอน deploy)
3. จด `Channel ID` และ `Channel secret`

### 3. ตั้งค่า environment

```bash
cp .env.example .env.local
# แก้ค่าทุกตัวใน .env.local
```

### 4. รัน

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 → กด "เข้าสู่ระบบด้วย LINE"

> **ทดสอบ LINE Login จากมือถือ:** LINE ต้องการ HTTPS callback — ใช้ `ngrok http 3000` แล้วเพิ่ม URL ของ ngrok เป็น Callback URL อีกอัน พร้อมแก้ `NEXT_PUBLIC_APP_URL`

### 5. ตั้งตัวเองเป็น Admin

หลัง login ครั้งแรก รันใน SQL Editor:

```sql
update profiles set role = 'admin' where nickname = 'ชื่อเล่นของคุณ';
```

## โครงสร้างโปรเจ็ค

```
app/          หน้าจอ + routes (App Router)
features/     business logic แยกตามฟีเจอร์ (auth, profile, games, ...)
components/   UI components กลาง
lib/          Supabase clients, LINE OAuth, utilities
db/           SQL migrations
docs/         PRD, Architecture, Database design, Roadmap
```

## Roadmap ถัดไป (Phase 3)

AI วิเคราะห์วิดีโอ: ตรวจจับชู้ตลง/ไม่ลง → ติดตามผู้เล่น → ระบบยืนยันเหตุการณ์ → สถิติอัตโนมัติเข้าโปรไฟล์ (สถาปัตยกรรม + ตาราง `ai_analysis_jobs`/`ai_events` รองรับไว้แล้ว ไม่ต้องรื้อระบบ)
