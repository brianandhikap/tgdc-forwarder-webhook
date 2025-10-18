# Telegram to Discord Forwarder

Forward messages from Telegram groups to Discord channels via webhooks, including profile photos and media files.

## Setup Instructions

### 1. Database Setup
- Create a MySQL database named `webhook`
- Run the SQL commands from `db.txt` to create the required tables
- Add webhook mappings to the `webhook_mappings` table with your group IDs, topic IDs, and Discord webhook URLs

### 2. Environment Configuration
- Copy `contoh_env.txt` to `.env`
- Fill in your Telegram API credentials:
  - Get API_ID and API_HASH from https://my.telegram.org/apps
  - Add your phone number
  - Session will be auto-generated on first run
- Configure MySQL connection details
- Set your server HOST and PORT

### 3. Installation
```
npm install
```

### 4. Running
```
npm start
```

For development with auto-reload:
```
npm run dev
```

## Database Schema

### webhook_mappings
Maps Telegram groups/topics to Discord webhooks
- `group_id`: Telegram group ID (negative number)
- `topic_id`: Telegram topic ID (0 for general)
- `webhook_url`: Discord webhook URL

### profile_photos
Caches profile photos for faster forwarding
- `user_id`: Telegram user ID
- `username`: User's display name
- `photo_filename`: Saved filename
- `photo_url`: Public URL to access the photo

### message_logs
Tracks forwarded messages for auditing
- `telegram_message_id`: Original Telegram message ID
- `group_id`: Source group ID
- `topic_id`: Source topic ID
- `user_id`: Sender's user ID
- `username`: Sender's username
- `content`: Message text
- `media_count`: Number of media files

## Features

- Forward text messages to Discord
- Forward messages with media (photos, videos, documents)
- Preserve sender's username and profile photo
- Support for Telegram topics (channels)
- Automatic profile photo caching
- Message logging for auditing
- Graceful error handling

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /ava/:filename` - Serve profile photos

## Notes

- Profile photos are served via Express at `http://HOST:PORT/ava/`
- Temporary media files are cleaned up after forwarding
- Session file is saved locally for persistence
- Supports multiple group/topic to webhook mappings
