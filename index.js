import dotenv from "dotenv"
import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import { TelegramClient } from "./src/telegram-client.js"
import { DiscordForwarder } from "./src/discord-forwarder.js"
import { Database } from "./src/database.js"

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Initialize Express server
const app = express()
const PORT = process.env.PORT || 1909
const HOST = process.env.HOST || "localhost"

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// Serve profile photos
app.use("/ava", express.static(path.join(__dirname, "media", "avatars")))

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Initialize services
const db = new Database()
const discordForwarder = new DiscordForwarder(db)
const telegramClient = new TelegramClient(db, discordForwarder)

// Start server
app.listen(PORT, HOST, async () => {
  console.log(`Express server running at http://${HOST}:${PORT}`)

  try {
    await db.connect()
    console.log("[v0] Database connected successfully")

    const startupTimeout = setTimeout(() => {
      console.error("[v0] Telegram client startup timeout - check your credentials")
      process.exit(1)
    }, 60000) // 60 second timeout

    await telegramClient.start()
    clearTimeout(startupTimeout)
    console.log("[v0] Telegram client started successfully")
  } catch (error) {
    console.error("[v0] Failed to start services:", error.message)
    process.exit(1)
  }
})

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...")
  await telegramClient.disconnect()
  await db.disconnect()
  process.exit(0)
})
