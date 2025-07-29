const { Client, Databases } = require('node-appwrite');

// Appwrite configuration
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || 'your-project-id';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || 'your-api-key';

// Database configuration
const DATABASE_ID = 'mafia_game_db';
const ROOMS_COLLECTION_ID = 'rooms';
const GAME_STATES_COLLECTION_ID = 'game_states';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

module.exports = {
  client,
  databases,
  DATABASE_ID,
  ROOMS_COLLECTION_ID,
  GAME_STATES_COLLECTION_ID,
}; 