const { WebcastPushConnection } = require('tiktok-live-connector');
const { Rcon } = require('rcon-client');

// Konfigurasi RCON
const rconConfig = {
    host: "194.233.75.221", 
    port: 25519,     
    password: "bajamen123"
};

async function sendToMinecraft(message) {
    try {
        const rcon = await Rcon.connect(rconConfig);
        await rcon.send(`say ${message}`); 
        console.log(`Pesan terkirim ke Minecraft: ${message}`);
        rcon.end();
    } catch (error) {
        console.error("Gagal mengirim pesan ke Minecraft:", error);
    }
}

const username = "siwareal2";
const tiktokLive = new WebcastPushConnection(username);

tiktokLive.connect().then(() => {
    console.log(`Terhubung ke live stream ${username}`);
}).catch(err => {
    console.log("Gagal terhubung:", err);
});

tiktokLive.on('chat', data => {
    const chatMessage = `[TikTok] ${data.uniqueId}: ${data.comment}`;
    console.log(chatMessage);
    sendToMinecraft(chatMessage);
});

tiktokLive.on('gift', data => {
    const giftMessage = `[TikTok] ${data.uniqueId} mengirim ${data.giftName} x${data.repeatCount}`;
    console.log(giftMessage);
    sendToMinecraft(giftMessage);
});
