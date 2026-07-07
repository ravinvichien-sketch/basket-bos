# 🚀 คู่มือ Deploy — Basket Bos

เอา app ขึ้นใช้จริงกับก๊วนภายใน ~1 ชั่วโมง (ทุกบริการมี free tier พอสำหรับ 1 ก๊วน)

## 1. Supabase (database + storage) — ฟรี

1. [supabase.com](https://supabase.com) → New project (region: Singapore ใกล้ไทยสุด)
2. SQL Editor → รัน migration **ตามลำดับ**: `001_init.sql` → `002_registration_extras.sql` → `003_payments_realtime.sql` → `004_stats_card.sql` → `005_videos.sql`
3. จดค่าจาก Settings → API: `Project URL`, `anon key`, `service_role key`

## 2. LINE Developers — ฟรี

สร้าง Provider 1 อัน แล้วสร้าง **2 channels**:

**A) LINE Login channel** (สำหรับ login)
- จด Channel ID + Channel secret
- Callback URL: `https://YOUR-DOMAIN.vercel.app/auth/callback` (+ `http://localhost:3000/auth/callback` ไว้เทสต์)

**B) Messaging API channel** (สำหรับ push แจ้งเตือน — ข้ามได้ถ้ายังไม่ต้องการ)
- ออก Channel access token (long-lived) → `LINE_MESSAGING_TOKEN`
- จด Channel secret → `LINE_MESSAGING_CHANNEL_SECRET`
- Webhook URL: `https://YOUR-DOMAIN.vercel.app/api/webhooks/line` → Enable
- ปิด auto-reply, เปิด webhooks
- ชวนสมาชิกก๊วน**แอดบอทเป็นเพื่อน**ถึงจะรับ push ได้

## 3. Vercel — ฟรี

1. Push โค้ดขึ้น GitHub → [vercel.com](https://vercel.com) → Import repo
2. ใส่ Environment Variables ตาม `.env.example`:

| ตัวแปร | ค่า |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-DOMAIN.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | จากข้อ 1 |
| `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` | จากข้อ 2A |
| `LINE_MESSAGING_TOKEN` / `LINE_MESSAGING_CHANNEL_SECRET` | จากข้อ 2B (ไม่บังคับ) |
| `AUTH_PASSWORD_SECRET` | สตริงสุ่มยาวๆ (`openssl rand -hex 32`) — **ห้ามเปลี่ยนหลังเปิดใช้** |
| `PROMPTPAY_ID` | เบอร์มือถือ/เลขบัตร ปชช. คนรับเงินค่าสนาม |
| `OPENAI_API_KEY` | (ไม่บังคับ) สำหรับ AI แต่งรูปการ์ด |

3. Deploy → เปิด URL → login ด้วย LINE

## 4. หลัง deploy ครั้งแรก

```sql
-- ตั้งตัวเองเป็นแอดมิน (รันใน Supabase SQL Editor หลัง login ครั้งแรก)
update profiles set role = 'admin' where nickname = 'ชื่อเล่นของคุณ';
```

จากนั้น: สร้างเกมแรก → แชร์ลิงก์เข้ากลุ่ม LINE → สมาชิกกด login → ลงชื่อ 🎉

## Checklist ก่อนเปิดใช้จริง

- [ ] รัน migrations ครบ 5 ไฟล์ตามลำดับ
- [ ] Login ผ่าน LINE ได้จากมือถือ (ทดสอบใน LINE browser)
- [ ] สร้างเกม → ลงชื่อ → ถอนตัว → สำรองเลื่อนอัตโนมัติ
- [ ] สแกน PromptPay QR ด้วยแอปธนาคารจริง — ยอดขึ้นถูกต้อง
- [ ] จัดทีม 4 ทีม → ล็อค → มี push แจ้งทีม (ถ้าตั้ง Messaging API)
- [ ] บันทึกสถิติ 1 เกม → การ์ด + leaderboard อัพเดต
- [ ] แชร์การ์ดเข้า LINE ได้

## ค่าใช้จ่ายโดยประมาณ (1 ก๊วน ~30 คน)

| บริการ | ราคา |
|---|---|
| Vercel Hobby | ฿0 |
| Supabase Free (500MB DB, 1GB storage) | ฿0 — วิดีโอเยอะๆ อาจต้อง Pro $25/เดือน |
| LINE Login + Messaging (push < 200 ข้อความ/เดือน) | ฿0 |
| OpenAI (AI แต่งรูป) | ~฿1–3/รูป ตามการใช้ |
