import axios from "axios"
import FormData from "form-data"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class DiscordForwarder {
  constructor(database) {
    this.database = database
  }

  async forwardMessage(webhookUrl, username, avatarUrl, message, userId) {
    try {
      // Text-only message
      if (!message.media) {
        await axios.post(webhookUrl, {
          username: username,
          avatar_url: avatarUrl,
          content: message.text || "(empty message)",
        })
        console.log(`[v0] Forwarded text message from ${username}`)
        return
      }

      // Message with media
      const form = new FormData()
      form.append("username", username)
      if (avatarUrl) {
        form.append("avatar_url", avatarUrl)
      }
      form.append("content", message.text || "(media message)")

      // Download and attach media
      const mediaFiles = await this.downloadMedia(message)
      mediaFiles.forEach((file, index) => {
        form.append(`file[${index}]`, fs.createReadStream(file))
      })

      await axios.post(webhookUrl, form, {
        headers: form.getHeaders(),
      })

      console.log(`[v0] Forwarded message with ${mediaFiles.length} media file(s) from ${username}`)

      // Cleanup temp files
      mediaFiles.forEach((file) => {
        try {
          fs.unlinkSync(file)
        } catch (err) {
          console.error("[v0] Error deleting temp file:", err)
        }
      })
    } catch (error) {
      console.error("[v0] Error forwarding message to Discord:", error.message)
    }
  }

  async downloadMedia(message) {
    const files = []
    try {
      if (!message.media) return files

      const mediaDir = path.join(__dirname, "..", "media", "temp")
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true })
      }

      // Download media (implementation depends on Telegram media type)
      // This is a simplified version - you may need to handle different media types
      const filename = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const filepath = path.join(mediaDir, filename)

      // Note: Actual media download implementation would go here
      // This depends on the specific media type from Telegram

      if (fs.existsSync(filepath)) {
        files.push(filepath)
      }
    } catch (error) {
      console.error("[v0] Error downloading media:", error)
    }
    return files
  }
}
