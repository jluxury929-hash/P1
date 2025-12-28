const { ethers, Wallet, WebSocketProvider, Contract } = require('ethers');

const CONFIG = {
    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    WSS_URL: "wss://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",
    WHALE_MIN_ETH: ethers.parseEther("10"), 
    GAS_LIMIT: 850000n,
    MARGIN_ETH: "0.005"
};

// Expanded ABIs for safety
const PAIR_ABI = [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() external view returns (address)"
];
const TITAN_ABI = ["function requestTitanLoan(address asset, uint256 amount, address[] path) external returns (uint256)"];

async function startWhaleStriker() {
    console.log(`\n🔱 APEX TITAN: DEPLOYED ON BASE`);
    
    const provider = new WebSocketProvider(CONFIG.WSS_URL);
    const signer = new Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
    const poolContract = new Contract(CONFIG.WETH_USDC_POOL, PAIR_ABI, provider);
    const titanInterface = new ethers.Interface(TITAN_ABI);

    // Dynamic Liquidity Scaling
    async function getSafeLoanAmount() {
        try {
            const [res0, res1] = await poolContract.getReserves();
            // In WETH/USDC on Base, res0 is WETH.
            const poolWethReserves = res0; 
            
            // Limit Flash Loan to 10% of Pool depth to minimize price impact/slippage
            const maxSafeAmount = poolWethReserves / 10n; 
            
            // Standard whale strike size
            let requestedAmount = ethers.parseEther("50"); 
            
            if (requestedAmount > maxSafeAmount) {
                console.log(`⚠️ Pool Depth Low: Scaling loan to ${ethers.formatEther(maxSafeAmount)} ETH`);
                return maxSafeAmount;
            }
            return requestedAmount;
        } catch (e) {
            return ethers.parseEther("2"); // Safe floor
        }
    }

    // Filter for Uniswap V2 Swaps
    const filter = {
        address: CONFIG.WETH_USDC_POOL,
        topics: [ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)")]
    };

    provider.on(filter, async (log) => {
        try {
            // Use Interface to decode properly
            const iface = new ethers.Interface(["event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"]);
            const parsed = iface.parseLog(log);
            
            // We care about the total volume of the swap
            const volume = parsed.args.amount0In > parsed.args.amount1In ? parsed.args.amount0In : parsed.args.amount1In;

            if (volume < CONFIG.WHALE_MIN_ETH) return;

            console.log(`🐋 Whale Detected: ${ethers.formatEther(volume)} ETH Swap`);

            const safeLoanAmount = await getSafeLoanAmount();
            const strikeData = titanInterface.encodeFunctionData("requestTitanLoan", [
                CONFIG.WETH, safeLoanAmount, [CONFIG.WETH, CONFIG.USDC]
            ]);

            // Simulation with StaticCall (Ethers v6)
            const potentialProfitHex = await provider.call({
                to: CONFIG.TARGET_CONTRACT,
                data: strikeData,
                from: signer.address
            });
            
            const potentialProfit = BigInt(potentialProfitHex);
            const feeData = await provider.getFeeData();
            const gasCost = CONFIG.GAS_LIMIT * (feeData.maxFeePerGas || feeData.gasPrice);
            const aaveFee = (safeLoanAmount * 5n) / 10000n; // 0.05%

            if (potentialProfit > (gasCost + ethers.parseEther(CONFIG.MARGIN_ETH) + aaveFee)) {
                const tx = await signer.sendTransaction({
                    to: CONFIG.TARGET_CONTRACT,
                    data: strikeData,
                    gasLimit: CONFIG.GAS_LIMIT,
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                    maxFeePerGas: feeData.maxFeePerGas,
                    type: 2
                });
                console.log(`🚀 STRIKE SUCCESSFUL: ${tx.hash}`);
            }
        } catch (e) {
            // Often triggers if simulation reverts (profit not high enough)
        }
    });

    provider.websocket.on("close", () => {
        console.log("WS Closed. Reconnecting...");
        setTimeout(startWhaleStriker, 5000);
    });
}

startWhaleStriker().catch(console.error);
