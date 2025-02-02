const { WebcastPushConnection } = require("tiktok-live-connector");
const { Rcon } = require("rcon-client");
const fs = require("fs");

const rconConfig = {
  host: "194.233.75.221",
  port: 25519,
  password: "bajamen123",
};

let lastGiftCache = new Map();
const GIFT_TIMEOUT_MS = 5000;

async function sendToMinecraft(command) {
  try {
    const rcon = await Rcon.connect(rconConfig);
    console.log(`Mengirim perintah ke Minecraft: ${command}`);
    const response = await rcon.send(command);
    console.log("Respons dari Minecraft:", response);
    await rcon.end();
  } catch (error) {
    console.error("Gagal mengirim perintah ke Minecraft:", error);
  }
}

function getRandomUsername() {
  const usernames = JSON.parse(fs.readFileSync("usernames.json", "utf8"));
  return usernames[Math.floor(Math.random() * usernames.length)];
}

function getCommandsByGift(giftName, donator, count) {
  const commandsConfig = JSON.parse(fs.readFileSync("commands.json", "utf8"));

  const commandSet = commandsConfig[giftName] || commandsConfig["default"];

  return commandSet.commands.map((command) =>
    command
      .replace("{donator}", donator)
      .replace("{gift}", giftName)
      .replace("{count}", count)
      .replace("{usernamerandom}", getRandomUsername())
  );
}

const username = "ff.esports.id";
const tiktokLive = new WebcastPushConnection(username);

tiktokLive
  .connect()
  .then(() => {
    console.log(`Terhubung ke live stream ${username}`);
  })
  .catch((err) => {
    console.log("Gagal terhubung:", err);
  });

tiktokLive.on("chat", async (data) => {
  const chatMessage = `[TikTok] ${data.uniqueId}: ${data.comment}`;
  console.log(chatMessage);

  await sendToMinecraft(`say ${chatMessage}`);
});

tiktokLive.on("gift", async (data) => {
  const donator = data.uniqueId;
  const giftName = data.giftName;
  const count = data.repeatCount;
  const giftId = data.giftId || `${donator}-${giftName}`;

  const now = Date.now();

  if (lastGiftCache.has(giftId)) {
    const lastTime = lastGiftCache.get(giftId);
    if (now - lastTime < GIFT_TIMEOUT_MS) {
      console.log(`[SKIP] Duplikasi gift terdeteksi: ${giftId}`);
      return;
    }
  }

  lastGiftCache.set(giftId, now);

  console.log(`[TikTok] ${donator} mengirim ${giftName} x${count}`);

  const commands = getCommandsByGift(giftName, donator, count);

  for (const command of commands) {
    await sendToMinecraft(command);
  }
});
