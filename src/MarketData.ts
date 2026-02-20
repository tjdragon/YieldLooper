export async function getMarketData() {
    // In a real application, this would query Aave and Morpho read contracts via Viem,
    // or use an API like DefiLlama. 
    // For the sake of the hackathon/demo, we return mock data that creates a profitable spread.

    return {
        aave: {
            supplyAPY: 3.5,
            borrowAPY: 1.2,
            ltv: 0.80
        },
        morpho: {
            supplyAPY: 9.5,
            borrowAPY: 1.8,
            matchRate: 0.95
        },
        ethPrice: 2800,
        gasPriceGwei: 15
    };
}
