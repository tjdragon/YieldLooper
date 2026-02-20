export interface Intent {
    shouldLoop: boolean;
    targetLeverage: number;
    expectedNetYield: number;
    reasoning: string;
}

export class Filter {
    private readonly MAX_LEVERAGE = 3.0;
    private readonly MIN_EXPECTED_YIELD = 0.5; // 0.5% APY minimum net expected

    public validateIntent(intent: Intent): void {
        if (!intent.shouldLoop) {
            console.log(`Agent Intent: Unwind or Hold. Reason: ${intent.reasoning}`);
            return; // Safe to unwind if it chooses
        }

        if (intent.targetLeverage > this.MAX_LEVERAGE) {
            throw new Error(`GUARDRAIL TRIGGERED: Target leverage ${intent.targetLeverage} exceeds max of ${this.MAX_LEVERAGE}`);
        }

        if (intent.expectedNetYield < this.MIN_EXPECTED_YIELD) {
            console.warn(`Warning: Expected net yield is very low: ${intent.expectedNetYield}%`);
            // We might not throw, but at least warn
        }

        console.log(`✅ Filter passed intent: Leverage ${intent.targetLeverage}x is safe. Reason: ${intent.reasoning}`);
    }
}
