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

    await this.initializeSchema()
  }

  async initializeSchema() {
    const connection = await this.pool.getConnection()
    try {
      // Create webhook_mappings table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS webhook_mappings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          group_id BIGINT NOT NULL,
          topic_id INT NOT NULL DEFAULT 0,
          webhook_url VARCHAR(500) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_group_topic (group_id, topic_id),
          INDEX idx_group_id (group_id)
        )
      `)

      // Create profile_photos table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS profile_photos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT NOT NULL UNIQUE,
          username VARCHAR(255) NOT NULL,
          photo_filename VARCHAR(255) NOT NULL,
          photo_url VARCHAR(500) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id)
        )
      `)

      // Create message_logs table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS message_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          telegram_message_id BIGINT NOT NULL,
          group_id BIGINT NOT NULL,
          topic_id INT NOT NULL DEFAULT 0,
          user_id BIGINT NOT NULL,
          username VARCHAR(255) NOT NULL,
          content TEXT,
          media_count INT DEFAULT 0,
          forwarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_group_id (group_id),
          INDEX idx_user_id (user_id)
        )
      `)

      console.log("[v0] Database schema initialized successfully")
    } catch (error) {
      console.error("[v0] Error initializing database schema:", error.message)
      throw error
    } finally {
      connection.release()
    }
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
    } catch (error) {
      console.error("[v0] Error getting webhook URL:", error.message)
      throw error
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
         username = ?, 
         photo_filename = ?,
         photo_url = ?,
         updated_at = CURRENT_TIMESTAMP`,
        [userId, username, photoFilename, photoUrl, username, photoFilename, photoUrl],
      )
    } catch (error) {
      console.error("[v0] Error saving profile photo:", error.message)
      throw error
    } finally {
      connection.release()
    }
  }

  async getProfilePhoto(userId) {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.query("SELECT photo_url FROM profile_photos WHERE user_id = ?", [userId])
      return rows.length > 0 ? rows[0].photo_url : null
    } catch (error) {
      console.error("[v0] Error getting profile photo:", error.message)
      throw error
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
    } catch (error) {
      console.error("[v0] Error logging message:", error.message)
      throw error
    } finally {
      connection.release()
    }
  }

  async getAllWebhookMappings() {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.query(
        "SELECT group_id, topic_id, webhook_url FROM webhook_mappings ORDER BY group_id, topic_id",
      )
      return rows
    } catch (error) {
      console.error("[v0] Error getting all webhook mappings:", error.message)
      throw error
    } finally {
      connection.release()
    }
  }
}
