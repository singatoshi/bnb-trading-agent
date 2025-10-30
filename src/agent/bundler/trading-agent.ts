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

// --------------------------------------------------------------
// Types (simplified; library provides more)
// --------------------------------------------------------------
interface KlinesResponse extends Array<any> {} // [openTime, open, high, low, close, volume, ...]
interface TickerPrice { symbol: string; price: string; }
interface SymbolInfo {
  symbol: string;
  filters: Array<{ filterType: string; minQty?: string; stepSize?: string }>;
}
interface ExchangeInfo { symbols: SymbolInfo[]; }
interface OrderResponse { status: string; /* more fields */ }

// --------------------------------------------------------------
// Helper: convert datetime string (mm/dd/yyyy) to timestamp (ms)
// --------------------------------------------------------------
function convertTime(timeStr: string): number {
  try {
    const parsed = new Date(timeStr.split('/').reverse().join('-')); // mm/dd/yyyy -> yyyy-mm-dd
    if (isNaN(parsed.getTime())) {
      throw new Error('Invalid date');
    }
    return parsed.getTime();
  } catch (error) {
    throw new Error(`Invalid datetime format: ${timeStr}`);
  }
}