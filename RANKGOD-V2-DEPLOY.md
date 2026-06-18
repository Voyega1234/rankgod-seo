# RankGod V2 — Deploy Guide (Vercel)

## สิ่งที่เปลี่ยนใน V2
- เปลี่ยน AI provider จากเดิม → **Google Gemini** (ต้องการ API Key ใหม่)
- เพิ่ม tier: **Standard** (gemini-2.5-flash) และ **Premium** (gemini-3.5-flash)
- เพิ่ม sections ใหม่ในรายงาน: Quick Wins, Sales Talking Points, UX Insights, Business Insights, Role Insights

---

## ขั้นตอน Deploy

### 1. แตกไฟล์ทับ repo เดิม
```bash
unzip rankgod-v2.zip -d /path/to/your/rankgod-repo
```
หรือ copy ไฟล์ทั้งหมดทับ folder repo เดิมได้เลย  
(**ไม่ต้องลบ `.env.local` เดิม** — จะ update ใน step ถัดไป)

### 2. อัปเดต .env.local
เพิ่ม / แก้ไข key ต่อไปนี้:
```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
APP_PORT=3333
DATABASE_URL="file:./prisma/rankgod.db"
```

> ขอ GEMINI_API_KEY ได้ที่: https://aistudio.google.com/apikey (ฟรี)

### 3. ติดตั้ง dependencies
```bash
npm install
```

### 4. Push ขึ้น GitHub
```bash
git add .
git commit -m "chore: upgrade to RankGod v2"
git push
```
Vercel จะ auto-deploy ให้เองทันที

### 5. อัปเดต Environment Variables ใน Vercel Dashboard
ไปที่ **Vercel → Project → Settings → Environment Variables**

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | ใส่ key จาก Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.5-flash` |

> ถ้ามี key เดิมที่ไม่ใช้แล้ว (เช่น `OPENAI_API_KEY`) ลบออกได้เลย

---

## เสร็จแล้ว ✅
Vercel จะ redeploy อัตโนมัติหลัง push — ไม่ต้องทำอะไรเพิ่ม
