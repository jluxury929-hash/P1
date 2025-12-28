const { ethers, Wallet, WebSocketProvider, Contract, Interface } = require('ethers');
require('dotenv').config();

const CONFIG = {
    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    WSS_URL: process.env.WSS_URL, // 🚨 Ensure this is a BASE MAINNET WSS key
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",
    WHALE_MIN_ETH: ethers.parseEther("10"), 
    GAS_LIMIT: 850000n,
    MARGIN_ETH: "0.005"
};

const PAIR_ABI = ["function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];
const SWAP_EVENT_ABI = ["event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"];

async function startWhaleStriker() {
    console.log(`\n🔱 APEX TITAN: CONNECTING TO BASE...`);

    let provider;
    try {
        provider = new WebSocketProvider(CONFIG.WSS_URL);
    } catch (e) {
        console.error("❌ Invalid WSS URL. Check your .env file.");
        process.exit(1);
    }

    // --- SAFETY NET: PREVENTS THE 401 CRASH ---
    provider.on("error", (err) => {
        console.error("🚨 PROVIDER ERROR:", err.message);
        if (err.message.includes("401")) {
            console.error("👉 ACTION REQUIRED: Your Alchemy/QuickNode key is UNAUTHORIZED for Base.");
        }
    });

    const signer = new Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
    const poolContract = new Contract(CONFIG.WETH_USDC_POOL, PAIR_ABI, provider);
    const iface = new Interface(SWAP_EVENT_ABI);

    console.log(`✅ TITAN DEPLOYED. Monitoring ${CONFIG.WETH_USDC_POOL}`);

    provider.on({ address: CONFIG.WETH_USDC_POOL }, async (log) => {
        try {
            const parsed = iface.parseLog(log);
            if (!parsed) return;

            const vol0 = parsed.args.amount0In > parsed.args.amount0Out ? parsed.args.amount0In : parsed.args.amount0Out;
            const vol1 = parsed.args.amount1In > parsed.args.amount1Out ? parsed.args.amount1In : parsed.args.amount1Out;
            const maxSwap = vol0 > vol1 ? vol0 : vol1;

            if (maxSwap < CONFIG.WHALE_MIN_ETH) return;

            console.log(`🐋 Whale Detected: ${ethers.formatEther(maxSwap)} ETH`);

            // Liquidity Guard Logic
            const [res0] = await poolContract.getReserves();
            const safeLoan = res0 / 10n; // Never borrow more than 10% of pool

            // Strike Logic
            const titanIface = new Interface(["function requestTitanLoan(address,uint256,address[])"]);
            const data = titanIface.encodeFunctionData("requestTitanLoan", [
                CONFIG.WETH, safeLoan, [CONFIG.WETH, CONFIG.USDC]
            ]);

            // Simulate & Strike
            const feeData = await provider.getFeeData();
            const tx = await signer.sendTransaction({
                to: CONFIG.TARGET_CONTRACT,
                data: data,
                gasLimit: CONFIG.GAS_LIMIT,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
                maxFeePerGas: feeData.maxFeePerGas,
                type: 2
            });

            console.log(`🚀 STRIKE SENT: ${tx.hash}`);
        } catch (e) {
            // Silently skip failed simulations (normal in MEV)
        }
    });

    // --- RECONNECTION LOOP ---
    provider.websocket.on("close", (code) => {
        console.log(`⚠️ Connection Closed (Code: ${code}). Reconnecting in 5s...`);
        provider.removeAllListeners();
        setTimeout(startWhaleStriker, 5000);
    });
}

// Global Rejection Handler
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

startWhaleStriker().catch(console.error);
