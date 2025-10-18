import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class MediaHandler {
  static ensureDirectories() {
    const dirs = [path.join(__dirname, "..", "media", "avatars"), path.join(__dirname, "..", "media", "temp")]

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        console.log(`[v0] Created directory: ${dir}`)
      }
    })
  }

  static cleanupTempFiles() {
    const tempDir = path.join(__dirname, "..", "media", "temp")
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach((file) => {
        const filepath = path.join(tempDir, file)
        try {
          fs.unlinkSync(filepath)
        } catch (err) {
          console.error(`[v0] Error deleting temp file ${file}:`, err)
        }
      })
    }
  }
}
