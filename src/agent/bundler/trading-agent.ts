import { MainClient } from 'binance';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// --------------------------------------------------------------
// Binance client setup
// --------------------------------------------------------------
const apiKey = process.env.API_KEY || '';
const apiSecret = process.env.API_SECRET || '';

if (!apiKey || !apiSecret) {
  throw new Error('API_KEY and API_SECRET must be set in .env');
}

const client = new MainClient({ api_key: apiKey, api_secret: apiSecret });
