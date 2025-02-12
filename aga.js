const express = require("express");
const fs = require("fs");
const { WebcastPushConnection } = require("tiktok-live-connector");
const { Rcon } = require("rcon-client");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// In-memory database for pairings
// Each pairing contains a TikTok live username and an RCON configuration for a Minecraft server.
const pairings = new Map();
let nextPairingId = 1; // Simple auto-incrementing ID for pairings

// Timeout to avoid duplicate gift events (in milliseconds)
const GIFT_TIMEOUT_MS = 5000;

/**
 * Send a command to the Minecraft server using RCON.
 * @param {string} command - The Minecraft command to execute.
 * @param {Object} rconConfig - The RCON configuration object ({ host, port, password }).
 */
async function sendToMinecraft(command, rconConfig) {
  try {
    const rcon = await Rcon.connect(rconConfig);
    console.log(`Sending command to Minecraft: ${command}`);
    const response = await rcon.send(command);
    console.log("Response from Minecraft:", response);
    await rcon.end();
    return response;
  } catch (error) {
    console.error("Error sending command to Minecraft:", error);
    throw error;
  }
}

/**
 * Get a random username from the usernames.json file.
 */
function getRandomUsername() {
  const usernames = JSON.parse(fs.readFileSync("usernames.json", "utf8"));
  return usernames[Math.floor(Math.random() * usernames.length)];
}

/**
 * Read the commands configuration from commands.json and replace placeholders.
 * @param {string} giftName - Name of the gift.
 * @param {string} donator - The username of the TikTok donator.
 * @param {number} count - The repeat count of the gift.
 */
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

/**
 * Create a new pairing that connects a TikTok live stream to a Minecraft server via RCON.
 * @param {string} tiktokUsername - The TikTok username to listen to.
 * @param {Object} rconConfig - The RCON configuration ({ host, port, password }).
 */
async function createPairing(tiktokUsername, rconConfig) {
  const pairingId = String(nextPairingId++);
  const pairing = {
    id: pairingId,
    tiktokUsername,
    rconConfig,
    lastGiftCache: new Map(),
  };

  // Create a new TikTok live connection for the provided username
  pairing.tiktokConnection = new WebcastPushConnection(tiktokUsername);

  // Listen for chat events and forward them to the Minecraft server.
  pairing.tiktokConnection.on("chat", async (data) => {
    const chatMessage = `[TikTok ${tiktokUsername}] ${data.uniqueId}: ${data.comment}`;
    console.log(chatMessage);
    try {
      await sendToMinecraft(`say ${chatMessage}`, rconConfig);
    } catch (err) {
      console.error(
        `Error sending chat message from ${tiktokUsername} to Minecraft:`,
        err
      );
    }
  });

  // Listen for gift events and execute configured Minecraft commands.
  pairing.tiktokConnection.on("gift", async (data) => {
    const donator = data.uniqueId;
    const giftName = data.giftName;
    const count = data.repeatCount;
    const giftId = data.giftId || `${donator}-${giftName}`;
    const now = Date.now();

    // Avoid duplicate gift events within a short time window.
    if (pairing.lastGiftCache.has(giftId)) {
      const lastTime = pairing.lastGiftCache.get(giftId);
      if (now - lastTime < GIFT_TIMEOUT_MS) {
        console.log(
          `[SKIP] Duplicate gift detected for pairing ${pairingId}: ${giftId}`
        );
        return;
      }
    }
    pairing.lastGiftCache.set(giftId, now);
    console.log(
      `[TikTok ${tiktokUsername}] ${donator} sent ${giftName} x${count}`
    );

    // Get the list of Minecraft commands to execute based on the gift.
    const commands = getCommandsByGift(giftName, donator, count);
    for (const command of commands) {
      try {
        await sendToMinecraft(command, rconConfig);
      } catch (err) {
        console.error(
          `Error sending gift command for pairing ${pairingId}:`,
          err
        );
      }
    }
  });

  try {
    await pairing.tiktokConnection.connect();
    console.log(`Connected to TikTok live for username: ${tiktokUsername}`);
  } catch (error) {
    console.error(
      `Failed to connect to TikTok live for ${tiktokUsername}:`,
      error
    );
    // Optionally, you might choose to throw an error here.
  }

  // Store the pairing in the in-memory database.
  pairings.set(pairingId, pairing);
  return pairing;
}

/* ========== Express API Endpoints ========== */

/**
 * GET /pairings
 * Returns a list of all current pairings.
 */
app.get("/pairings", (req, res) => {
  const list = [];
  pairings.forEach((pairing) => {
    list.push({
      id: pairing.id,
      tiktokUsername: pairing.tiktokUsername,
      rconConfig: pairing.rconConfig,
    });
  });
  res.json(list);
});

/**
 * POST /pairings
 * Creates a new pairing.
 * Expected JSON body:
 * {
 *   "tiktokUsername": "example_username",
 *   "rconConfig": { "host": "x.x.x.x", "port": 25565, "password": "secret" }
 * }
 */
app.post("/pairings", async (req, res) => {
  const { tiktokUsername, rconConfig } = req.body;
  if (
    !tiktokUsername ||
    !rconConfig ||
    !rconConfig.host ||
    !rconConfig.port ||
    !rconConfig.password
  ) {
    return res
      .status(400)
      .json({ error: "Missing required tiktokUsername or rconConfig fields" });
  }

  try {
    const pairing = await createPairing(tiktokUsername, rconConfig);
    res.status(201).json({
      message: "Pairing created successfully",
      pairing: {
        id: pairing.id,
        tiktokUsername: pairing.tiktokUsername,
        rconConfig: pairing.rconConfig,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create pairing", details: error.message });
  }
});

/**
 * DELETE /pairings/:id
 * Deletes a pairing and disconnects from its TikTok live stream.
 */
app.delete("/pairings/:id", async (req, res) => {
  const pairingId = req.params.id;
  const pairing = pairings.get(pairingId);
  if (!pairing) {
    return res.status(404).json({ error: "Pairing not found" });
  }
  try {
    // Disconnect from the TikTok live connection.
    await pairing.tiktokConnection.disconnect();
    pairings.delete(pairingId);
    res.json({ message: "Pairing deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete pairing", details: error.message });
  }
});

/**
 * POST /pairings/:id/send-command
 * (Optional) Manually send a command to the Minecraft server for a specific pairing.
 * Expected JSON body:
 * {
 *   "command": "say Hello from API!"
 * }
 */
app.post("/pairings/:id/send-command", async (req, res) => {
  const pairingId = req.params.id;
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Missing command in request body" });
  }
  const pairing = pairings.get(pairingId);
  if (!pairing) {
    return res.status(404).json({ error: "Pairing not found" });
  }
  try {
    const response = await sendToMinecraft(command, pairing.rconConfig);
    res.json({ message: "Command sent successfully", response });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to send command", details: error.message });
  }
});

/**
 * GET /status
 * A simple endpoint to verify that the API server is running.
 */
app.get("/status", (req, res) => {
  res.json({ status: "API server is running", pairings: pairings.size });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
