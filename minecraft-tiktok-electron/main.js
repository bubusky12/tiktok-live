const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { WebcastPushConnection } = require('tiktok-live-connector');
const { Rcon } = require('rcon-client');

// Konfigurasi RCON
const rconConfig = {
    host: "194.233.75.221", 
    port: 25519,     
    password: "bajamen123"
};

let tiktokLive;
let commandsConfig;

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

// Menyimpan konfigurasi TikTok dan commands.json
ipcMain.handle('save-config', async (event, config) => {
    const { tiktokUsername, commands } = config;

    try {
        // Simpan username TikTok dan perintah ke dalam variabel global
        tiktokLive = new WebcastPushConnection(tiktokUsername);
        commandsConfig = commands;

        await tiktokLive.connect();
        console.log(`Terhubung ke live stream ${tiktokUsername}`);

        tiktokLive.on('chat', async (data) => {
            const chatMessage = `[TikTok] ${data.uniqueId}: ${data.comment}`;
            console.log(chatMessage);
            await sendToMinecraft(`say ${chatMessage}`);
        });

        tiktokLive.on('gift', async (data) => {
            const donator = data.uniqueId;
            const giftName = data.giftName;
            const count = data.repeatCount;
            const giftId = data.giftId || `${donator}-${giftName}`;

            const commands = getCommandsByGift(giftName, donator, count);
            for (const command of commands) {
                await sendToMinecraft(command);
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Gagal menghubungkan ke TikTok:", error);
        return { success: false, error: error.message };
    }
});

// Mendapatkan perintah berdasarkan donasi TikTok
function getCommandsByGift(giftName, donator, count) {
    const commandSet = commandsConfig[giftName] || commandsConfig["default"];

    return commandSet.commands.map(command =>
        command
            .replace('{donator}', donator)
            .replace('{gift}', giftName)
            .replace('{count}', count)
    );
}

// Mengambil username acak

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.js'),
            nodeIntegration: true, // Aktifkan nodeIntegration agar renderer bisa menggunakan Node.js API
            contextIsolation: false, // Nonaktifkan contextIsolation
        },
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
