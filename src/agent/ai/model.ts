export class AIModel {
  async predict(marketData: any): Promise<string> {
    // dummy ML model logic
    return marketData.volatility > 0.5 ? "BUY" : "SELL";
  }
}