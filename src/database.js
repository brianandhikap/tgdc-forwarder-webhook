import mysql from "mysql2/promise.js"

export class Database {
  constructor() {
    this.pool = null
  }

  async connect() {
    this.pool = await mysql.createPool({
      host: process.env.MYSQL_HOST_Webhook,
      user: process.env.MYSQL_USER_Webhook,
      password: process.env.MYSQL_PASSWORD_Webhook,
      database: process.env.MYSQL_DATABASE_Webhook,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end()
    }
  }

  async getWebhookUrl(groupId, topicId = 0) {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.query(
        "SELECT webhook_url FROM webhook_mappings WHERE group_id = ? AND topic_id = ?",
        [groupId, topicId],
      )
      return rows.length > 0 ? rows[0].webhook_url : null
    } finally {
      connection.release()
    }
  }

  async saveProfilePhoto(userId, username, photoFilename, photoUrl) {
    const connection = await this.pool.getConnection()
    try {
      await connection.query(
        `INSERT INTO profile_photos (user_id, username, photo_filename, photo_url) 
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         username = VALUES(username), 
         photo_filename = VALUES(photo_filename),
         photo_url = VALUES(photo_url),
         updated_at = CURRENT_TIMESTAMP`,
        [userId, username, photoFilename, photoUrl],
      )
    } finally {
      connection.release()
    }
  }

  async getProfilePhoto(userId) {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.query("SELECT photo_url FROM profile_photos WHERE user_id = ?", [userId])
      return rows.length > 0 ? rows[0].photo_url : null
    } finally {
      connection.release()
    }
  }

  async logMessage(telegramMessageId, groupId, topicId, userId, username, content, mediaCount = 0) {
    const connection = await this.pool.getConnection()
    try {
      await connection.query(
        `INSERT INTO message_logs (telegram_message_id, group_id, topic_id, user_id, username, content, media_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [telegramMessageId, groupId, topicId, userId, username, content, mediaCount],
      )
    } finally {
      connection.release()
    }
  }
}
