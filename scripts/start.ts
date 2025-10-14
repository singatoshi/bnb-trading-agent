import { Trader } from "../src/agent/core/trader";
import { AIModel } from "../src/agent/ai/model";
import { MEVProtector } from "../src/agent/bundler/mevProtector";
import { config } from "../src/config";

(async () => {
  const ai = new AIModel();
  const trader = new Trader({}, ai);
  const mev = new MEVProtector();

  const marketData = { volatility: Math.random() };
  const signal = await ai.predict(marketData);
  const tx = { signal };
  const protectedTx = await mev.protectTransaction(tx);
  await trader.executeStrategy(signal);
})();