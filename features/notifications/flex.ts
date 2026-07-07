/**
 * LINE Flex Message templates for interactive game sign-up via LINE chat.
 * These are JSON payloads for the LINE Messaging API Flex Message format.
 */

interface GameBrief {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  confirmed: number;
  maxPlayers: number;
}

/** Flex Carousel showing available games with join/roster buttons */
export function gameListFlex(games: GameBrief[]) {
  return {
    type: "flex",
    altText: "🏀 เลือกเกมที่ต้องการลงชื่อ",
    contents: {
      type: "carousel",
      contents: games.slice(0, 10).map((g) => ({
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          paddingAll: "16px",
          contents: [
            {
              type: "text",
              text: g.title,
              weight: "bold",
              size: "lg",
              wrap: true,
            },
            {
              type: "text",
              text: `📅 ${g.startsAt}`,
              size: "sm",
              color: "#94a3b8",
            },
            {
              type: "text",
              text: `📍 ${g.location}`,
              size: "sm",
              color: "#94a3b8",
              wrap: true,
            },
            {
              type: "text",
              text: `👥 ${g.confirmed}/${g.maxPlayers} คน`,
              size: "sm",
              color: "#94a3b8",
            },
          ],
        },
        footer: {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#F97316",
              action: {
                type: "postback",
                label: "✅ ลงชื่อ",
                data: `join:${g.id}`,
              },
            },
            {
              type: "button",
              style: "secondary",
              action: {
                type: "postback",
                label: "📋 ดูคิว",
                data: `roster:${g.id}`,
              },
            },
          ],
        },
      })),
    },
  };
}

/** Flex Message showing the current roster for a specific game */
export function rosterFlex(
  title: string,
  confirmed: string[],
  waitlist: string[],
  maxPlayers: number
) {
  const bodyContents: unknown[] = [
    {
      type: "text",
      text: `🏀 ${title}`,
      weight: "bold",
      size: "lg",
      wrap: true,
    },
    { type: "separator", margin: "md" },
    {
      type: "text",
      text: `👥 ตัวจริง (${confirmed.length}/${maxPlayers})`,
      weight: "bold",
      size: "sm",
      margin: "md",
      color: "#34d399",
    },
    ...(confirmed.length > 0
      ? confirmed.map((n, i) => ({
          type: "text",
          text: `${i + 1}. ${n}`,
          size: "sm",
          margin: "xs",
        }))
      : [
          {
            type: "text",
            text: "ยังไม่มีผู้เล่น",
            size: "sm",
            color: "#64748b",
            margin: "xs",
          },
        ]),
  ];

  if (waitlist.length > 0) {
    bodyContents.push(
      { type: "separator", margin: "md" },
      {
        type: "text",
        text: `⏳ สำรอง (${waitlist.length})`,
        weight: "bold",
        size: "sm",
        margin: "md",
        color: "#fbbf24",
      },
      ...waitlist.map((n, i) => ({
        type: "text",
        text: `${i + 1}. ${n}`,
        size: "sm",
        margin: "xs",
      }))
    );
  }

  return {
    type: "flex",
    altText: `📋 โรสเตอร์: ${title}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: bodyContents,
      },
    },
  };
}
