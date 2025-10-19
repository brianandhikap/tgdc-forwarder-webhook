import { TelegramClient as TgClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import { NewMessage } from "telegram/events/index.js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import readline from "readline"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class TelegramClient {
  constructor(database, discordForwarder) {
    this.database = database
    this.discordForwarder = discordForwarder
    this.client = null
    this.sessionFile = path.join(__dirname, "..", "telegram_session.txt")
    this.isConnected = false
  }

  async promptForCode(message) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      rl.question(message, (answer) => {
        rl.close()
        resolve(answer)
      })
    })
  }

  async start() {
    try {
      let session = ""

      // Load existing session if available
      if (fs.existsSync(this.sessionFile)) {
        session = fs.readFileSync(this.sessionFile, "utf-8")
        console.log("[v0] Existing session found, attempting to reconnect...")
      }

      this.client = new TgClient(
        new StringSession(session),
        Number.parseInt(process.env.TELEGRAM_API_ID),
        process.env.TELEGRAM_API_HASH,
        {
          connectionRetries: 5,
          retryDelay: 1000,
          requestRetries: 5,
        },
      )

      await this.client.start({
        phoneNumber: process.env.TELEGRAM_PHONE,
        password: async () => {
          const password = await this.promptForCode("Enter your 2FA password: ")
          return password
        },
        phoneCode: async () => {
          const code = await this.promptForCode("Enter the code you received: ")
          return code
        },
        onError: (err) => {
          console.error("[v0] Telegram authentication error:", err.message)
        },
      })

      const sessionString = this.client.session.save()
      fs.writeFileSync(this.sessionFile, sessionString)
      console.log("[v0] Session saved successfully")

      if (!session) {
        console.log("[v0] First time setup complete! Session string saved to telegram_session.txt")
        console.log("[v0] You can now copy this session to your .env file as TELEGRAM_SESSION")
      }

      this.client.addEventHandler(this.handleNewMessage.bind(this), new NewMessage({}))

      this.isConnected = true
      console.log("[v0] Telegram client connected and listening for messages...")
    } catch (error) {
      console.error("[v0] Failed to start Telegram client:", error.message)
      throw error
    }
  }

  async handleNewMessage(event) {
    try {
      const message = event.message

      // Skip outgoing messages
      if (message.out) return

      console.log("[v0] DEBUG - message.peerId:", JSON.stringify(message.peerId, null, 2))
      console.log("[v0] DEBUG - message.replyTo:", JSON.stringify(message.replyTo, null, 2))
      console.log("[v0] DEBUG - message.topicId:", message.topicId)
      console.log("[v0] DEBUG - Full message keys:", Object.keys(message))

      let groupId
      if (message.peerId.channelId) {
        groupId = Number.parseInt(`-100${message.peerId.channelId}`)
      } else if (message.peerId.chatId) {
        // Regular group: add - prefix
        groupId = -message.peerId.chatId
      } else {
        console.log("[v0] Could not determine group ID from message")
        return
      }

      const topicId = message.topicId || message.replyTo?.topicId || message.replyTo?.replyToTopId || 0
      const userId = message.senderId.userId

      let username = "Unknown"
      let sender = null

      try {
        sender = await this.client.getEntity(message.senderId)
        username = sender.username || sender.firstName || `User${userId}`
      } catch (err) {
        console.log(`[v0] Could not fetch sender entity, using fallback: ${err.message}`)
        // Fallback: use raw user ID if entity cannot be resolved
        username = `User${userId}`
      }

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
        if (sender) {
          const photo = await this.client.getProfilePhotos(sender)
          if (photo.length > 0) {
            avatarUrl = await this.downloadAndSaveProfilePhoto(userId, username, photo[0])
          }
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
      console.error("[v0] Error handling message:", error.message)
      console.error("[v0] Stack trace:", error.stack)
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
      console.error("[v0] Error downloading profile photo:", error.message)
      return null
    }
  }

  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.disconnect()
        this.isConnected = false
        console.log("[v0] Telegram client disconnected")
      }
    } catch (error) {
      console.error("[v0] Error disconnecting Telegram client:", error.message)
    }
  }
}
