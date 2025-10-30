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

// --------------------------------------------------------------
// Helper: fetch historical klines and compute min / max means
// --------------------------------------------------------------
async function getHistoricalPrices(
  symbol: string,
  startTime: number,
  endTime?: number,
  interval: string = '1m'
): Promise<{ minMean: number; maxMean: number } | null> {
  const intervalMap: { [key: string]: string } = {
    '1MINUTE': '1m',
    '30MINUTE': '30m',
    '1WEEK': '1w',
  };

  const binanceInterval = intervalMap[interval] || interval;
  if (!binanceInterval) {
    console.error('Error: invalid interval');
    return null;
  }

  try {
    const klines: KlinesResponse = await client.klines({
      symbol,
      interval: binanceInterval,
      startTime,
      endTime,
      limit: 500, // Max per request; adjust as needed
    });

    if (!klines || klines.length === 0) {
      console.error('Error: No data available');
      return null;
    }

    const lows = klines.map(k => parseFloat(k[3])); // low price
    const highs = klines.map(k => parseFloat(k[2])); // high price

    const minMean = lows.reduce((a, b) => a + b, 0) / lows.length;
    const maxMean = highs.reduce((a, b) => a + b, 0) / highs.length;

    return { minMean, maxMean };
  } catch (error) {
    console.error(`Error fetching historical prices: ${error}`);
    return null;
  }
}

// --------------------------------------------------------------
// Helper: get current price from ticker
// --------------------------------------------------------------
async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const ticker: TickerPrice = await client.getSymbolTickerPrice({ symbol });
    return parseFloat(ticker.price);
  } catch (error) {
    console.error(`Error fetching current price: ${error}`);
    return null;
  }
}

// --------------------------------------------------------------
// Helper: fetch minimum trade quantity for a symbol
// --------------------------------------------------------------
async function getMinQuantity(symbol: string): Promise<number> {
  try {
    const info: ExchangeInfo = await client.getExchangeInfo();
    const symInfo = info.symbols.find(s => s.symbol === symbol);
    if (!symInfo) {
      throw new Error('Symbol not found');
    }

    const lotSizeFilter = symInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    if (!lotSizeFilter || !lotSizeFilter.minQty) {
      throw new Error('MinQty not found in filters');
    }

    return parseFloat(lotSizeFilter.minQty);
  } catch (error) {
    console.error(`Error fetching min quantity: ${error}`);
    return 0.001; // Fallback; adjust per symbol
  }
}

// --------------------------------------------------------------
// Helper: compute how many units we can actually buy
// --------------------------------------------------------------
function getQuantityBuy(
  minQuantity: number,
  currentPrice: number,
  investment: number
): number {
  const totalPossible = investment / currentPrice;
  let quantity = Math.floor(totalPossible / minQuantity) * minQuantity;

  // Determine precision from stepSize (simplified; use symInfo for exact)
  const stepSize = minQuantity / 10; // Approximate
  const precision = Math.max(1, Math.floor(Math.log10(1 / stepSize)));
  return parseFloat(quantity.toFixed(precision));
}

// --------------------------------------------------------------
// Helper: compute profit from a sell
// --------------------------------------------------------------
function getProfits(
  investment: number,
  currentPrice: number,
  quantityBought: number
): number {
  return (currentPrice * quantityBought) - investment;
}

// Helper: delay function
// --------------------------------------------------------------
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------------------------------------------------------
// Main trading loop
// --------------------------------------------------------------
async function operation(
  symbol: string,
  initialInvestment: number,
  startTimeStr: string,
  endTimeStr?: string,
  interval: string = '1MINUTE'
): Promise<void> {
  const startTime = convertTime(startTimeStr);
  const endTime = endTimeStr ? convertTime(endTimeStr) : undefined;

  const result = await getHistoricalPrices(symbol, startTime, endTime, interval);
  if (!result) {
    console.error('Failed to get historical prices');
    return;
  }

  const { minMean, maxMean } = result;
  const minQuantity = await getMinQuantity(symbol);

  // State variables
  let buyMode = true;
  let sellMode = false;
  let quantity = 0.0;
  let investment = initialInvestment;
  let buyMoney = 0.0;
  let rest = 0.0;

  console.log(`Starting bot: minMean=${minMean}, maxMean=${maxMean}, minQty=${minQuantity}`);

  while (true) {
    const currentPrice = await getCurrentPrice(symbol);
    if (currentPrice === null) {
      await delay(2000);
      continue;
    }

    console.log(`Current price: ${currentPrice}, minMean: ${minMean}, maxMean: ${maxMean}`);