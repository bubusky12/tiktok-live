const { WebcastPushConnection } = require('tiktok-live-connector');
const { Rcon } = require('rcon-client');
const fs = require('fs');

// Konfigurasi RCON
const rconConfig = {
    host: "194.233.75.221", 
    port: 25519,     
    password: "bajamen123"
};

// Fungsi untuk mengirim command ke Minecraft melalui RCON
async function sendToMinecraft(command) {
    try {
        const rcon = await Rcon.connect(rconConfig);
        console.log(`Mengirim perintah ke Minecraft: ${command}`);
        const response = await rcon.send(command);
        console.log('Respons dari Minecraft:', response);
        await rcon.end();
    } catch (error) {
        console.error("Gagal mengirim perintah ke Minecraft:", error);
    }
}

// Fungsi untuk mendapatkan username acak
function getRandomUsername() {
    const usernames = JSON.parse(fs.readFileSync('usernames.json', 'utf8'));
    const randomIndex = Math.floor(Math.random() * usernames.length);
    return usernames[randomIndex];
}

// Fungsi untuk mendapatkan commands berdasarkan donasi TikTok
function getCommandsByGift(giftName, donator, count) {
    const commandsConfig = JSON.parse(fs.readFileSync('commands.json', 'utf8'));

    // Cek apakah ada perintah khusus untuk gift ini, jika tidak gunakan default
    const commandSet = commandsConfig[giftName] || commandsConfig["default"];

    // Ganti placeholder dengan nilai aktual
    return commandSet.commands.map(command =>
        command
            .replace('{donator}', donator)
            .replace('{gift}', giftName)
            .replace('{count}', count)
            .replace('{usernamerandom}', getRandomUsername())
    );
}

// **Konfigurasi TikTok Live**
const username = "lcktiengviet"; // Ganti dengan username TikTok Anda
const tiktokLive = new WebcastPushConnection(username);

// **Hubungkan ke TikTok Live**
tiktokLive.connect().then(() => {
    console.log(`Terhubung ke live stream ${username}`);
}).catch(err => {
    console.log("Gagal terhubung:", err);
});

// **📌 Event Live Chat TikTok**
tiktokLive.on('chat', async (data) => {
    const chatMessage = `[TikTok] ${data.uniqueId}: ${data.comment}`;
    console.log(chatMessage);

    // Kirim chat ke Minecraft dengan /say
    await sendToMinecraft(`say ${chatMessage}`);
});

//**📌 Event Donasi TikTok**
tiktokLive.on('gift', async (data) => {
    const donator = data.uniqueId;
    const giftName = data.giftName;
    const count = data.repeatCount;

    console.log(`[TikTok] ${donator} mengirim ${giftName} x${count}`);

    // Dapatkan perintah berdasarkan gift
    const commands = getCommandsByGift(giftName, donator, count);

    // Jalankan semua perintah satu per satu di Minecraft
    for (const command of commands) {
        await sendToMinecraft(command);
    }
});
