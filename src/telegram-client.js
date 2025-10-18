import { TelegramClient as TgClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class TelegramClient {
  constructor(database, discordForwarder) {
    this.database = database
    this.discordForwarder = discordForwarder
    this.client = null
    this.sessionFile = path.join(__dirname, "..", "telegram_session.txt")
  }

  async start() {
    let session = ""

    // Load existing session if available
    if (fs.existsSync(this.sessionFile)) {
      session = fs.readFileSync(this.sessionFile, "utf-8")
    }

    this.client = new TgClient(
      new StringSession(session),
      Number.parseInt(process.env.TELEGRAM_API_ID),
      process.env.TELEGRAM_API_HASH,
      {
        connectionRetries: 5,
      },
    )

    // Handle new session
    this.client.addEventHandler(this.handleNewSession.bind(this), new NewMessage({}))

    await this.client.start({
      phoneNumber: process.env.TELEGRAM_PHONE,
      password: async () => {
        // If 2FA is needed, implement here
        return ""
      },
      onError: (err) => console.error("Telegram error:", err),
    })

    // Save session
    const sessionString = this.client.session.save()
    fs.writeFileSync(this.sessionFile, sessionString)
    console.log("Session saved. If this is first run, copy this session to .env TELEGRAM_SESSION")

    // Listen for new messages
    this.client.addEventHandler(this.handleNewMessage.bind(this), new NewMessage({}))
  }

  async handleNewSession() {
    const sessionString = this.client.session.save()
    fs.writeFileSync(this.sessionFile, sessionString)
    console.log("[v0] New session created. Session string:")
    console.log(sessionString)
  }

  async handleNewMessage(event) {
    try {
      const message = event.message

      // Skip outgoing messages
      if (message.out) return

      const groupId = message.peerId.channelId || message.peerId.chatId
      const topicId = message.replyTo?.replyToTopId || 0
      const userId = message.senderId.userId

      // Get sender info
      const sender = await this.client.getEntity(message.senderId)
      const username = sender.username || sender.firstName || "Unknown"

      console.log(`[v0] New message from ${username} in group ${groupId}, topic ${topicId}`)

      // Get webhook URL for this group/topic
      const webhookUrl = await this.database.getWebhookUrl(groupId, topicId)
      if (!webhookUrl) {
        console.log(`[v0] No webhook configured for group ${groupId}, topic ${topicId}`)
        return
      }

      // Handle profile photo
      let avatarUrl = null
      try {
        const photo = await this.client.getProfilePhotos(sender)
        if (photo.length > 0) {
          avatarUrl = await this.downloadAndSaveProfilePhoto(userId, username, photo[0])
        }
      } catch (err) {
        console.log(`[v0] Could not download profile photo for ${username}:`, err.message)
      }

      // Forward message
      await this.discordForwarder.forwardMessage(webhookUrl, username, avatarUrl, message, userId)

      // Log message
      const mediaCount = message.media ? 1 : 0
      await this.database.logMessage(message.id, groupId, topicId, userId, username, message.text || "", mediaCount)
    } catch (error) {
      console.error("[v0] Error handling message:", error)
    }
  }

  async downloadAndSaveProfilePhoto(userId, username, photo) {
    try {
      const filename = `${username.replace(/\s+/g, "_")}.jpg`
      const filepath = path.join(__dirname, "..", "media", "avatars", filename)

      // Create directory if not exists
      const dir = path.dirname(filepath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Download photo
      const buffer = await this.client.downloadProfilePhoto(photo)
      fs.writeFileSync(filepath, buffer)

      const photoUrl = `http://${process.env.HOST}:${process.env.PORT}/ava/${filename}`

      // Save to database
      await this.database.saveProfilePhoto(userId, username, filename, photoUrl)

      return photoUrl
    } catch (error) {
      console.error("[v0] Error downloading profile photo:", error)
      return null
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect()
    }
  }
}

// Import NewMessage event
import { NewMessage } from "telegram/events/index.js"
