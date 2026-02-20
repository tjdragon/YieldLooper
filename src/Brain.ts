import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export class Brain {
    private model: GenerativeModel;

    constructor(apiKey: string) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
    }

    async analyzeLoopStrategy(marketData: any): Promise<{ shouldLoop: boolean, targetLeverage: number, expectedNetYield: number, reasoning: string }> {
        const prompt = `
      You are a DeFi Yield Strategist. Analyze the following Ethereum market data:
      - Aave V3 ETH Supply APY: ${marketData.aave.supplyAPY}%
      - Aave V3 ETH Borrow APY: ${marketData.aave.borrowAPY}%
      - Morpho Blue Match Rate: ${marketData.morpho.matchRate * 100}%
      
      Goal: Create a recursive loop by borrowing ETH on Aave and supplying to Morpho.
      Constraints: 
      - Max Leverage: 3x.
      - Liquidation Buffer: Must stay 10% below Aave's LTV of ${marketData.aave.ltv}.
      
      Return a JSON object only:
      {
        "shouldLoop": boolean,
        "targetLeverage": number,
        "expectedNetYield": number,
        "reasoning": string
      }
    `;

        const result = await this.model.generateContent(prompt);
        // Google Generative AI with responseMimeType application/json will return text that can be parsed
        const response = JSON.parse(result.response.text());

        return response;
    }
}
