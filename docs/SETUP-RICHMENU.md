# ตั้งค่า LINE Rich Menu

ใช้ LINE Developer Console หรือ curl สร้าง Rich Menu ให้บอท

## 1. เปิด LINE Developer Console

1. ไปที่ https://developers.line.biz/console/
2. เลือก Provider → เลือก Messaging API Channel
3. จด `Channel access token` (Long-lived หรือ Short-lived)

## 2. สร้าง Rich Menu ด้วย curl

```bash
# ตั้งค่าตัวแปร
CHANNEL_ACCESS_TOKEN="your_token_here"

# สร้าง Rich Menu
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer $CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "size": {
    "width": 2500,
    "height": 843
  },
  "selected": true,
  "name": "basket-bos-menu",
  "chatBarText": "🏀 Basket Bos",
  "areas": [
    {
      "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
      "action": {
        "type": "postback",
        "data": "roster:latest",
        "label": "ดูคิว"
      }
    },
    {
      "bounds": { "x": 834, "y": 0, "width": 833, "height": 843 },
      "action": {
        "type": "postback",
        "data": "games",
        "label": "ลงชื่อเล่น"
      }
    },
    {
      "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
      "action": {
        "type": "uri",
        "uri": "https://[YOUR_APP_URL]",
        "label": "เปิดแอป"
      }
    }
  ]
}'
```

## 3. อัปโหลดรูป Rich Menu

ทำรูปขนาด 2500×843 px (PNG/JPG) แล้วอัปโหลด:

```bash
# ได้ richMenuId จาก step 2
RICH_MENU_ID="your_rich_menu_id"

curl -X POST "https://api-data.line.me/v2/bot/richmenu/$RICH_MENU_ID/content" \
  -H "Authorization: Bearer $CHANNEL_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary @richmenu.png
```

## 4. Set เป็น Default

```bash
curl -X POST "https://api.line.me/v2/bot/user/all/richmenu/$RICH_MENU_ID" \
  -H "Authorization: Bearer $CHANNEL_ACCESS_TOKEN"
```

## โครงสร้าง Rich Menu (2500×843)

```
┌─────────────┬─────────────┬─────────────┐
│             │             │             │
│   📋 ดูคิว   │  🏀 ลงชื่อ   │   เปิดแอป   │
│             │             │             │
└─────────────┴─────────────┴─────────────┘
```

## การตั้งค่าบน LINE Developer Console (วิธีง่ายกว่า)

1. ไปที่ LINE Developer Console → Messaging API channel
2. เลือกแท็บ "Rich menu"
3. กด "Create" → ใส่ชื่อ "Basket Bos"
4. แท็บ "Areas" → เพิ่ม 3 ปุ่มตามตาราง
5. อัปโหลดรูป
6. กด "Set as default rich menu"
