const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, Interface } = require('ethers');
require('dotenv').config();

// 1. BOOTSTRAP: CONFIGURATION
console.log("-----------------------------------------");
console.log("🟢 [BOOT] ULTIMATE WHALE STRIKER INITIALIZING...");

const CONFIG = {
    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ DUAL-LANE CONNECTIVITY
    WSS_URL: process.env.WSS_URL,          // FOR LISTENING (FAST)
    RPC_URL: "https://mainnet.base.org",   // FOR EXECUTING (RELIABLE)
    
    // 🏦 ASSETS
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",
    
    // 🔮 ORACLES
    GAS_ORACLE: "0x420000000000000000000000000000000000000F", // Base L1 Fee Oracle
    CHAINLINK_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", // ETH/USD Feed
    
    // ⚙️ PERFORMANCE
    GAS_LIMIT: 1250000n, // Safety buffer
    PRIORITY_BRIBE: 15n, // 15% Bribe to be FIRST (Front-run the competition)
    MARGIN_ETH: process.env.MARGIN_ETH || "0.015"
};

// 2. GLOBAL STATE (For Pricing)
let currentEthPrice = 0;

async function startUltimateWhaleStriker() {
    // A. KEY SANITIZER (Prevents "Invalid Private Key" Crash)
    let rawKey = process.env.TREASURY_PRIVATE_KEY;
    if (!rawKey) { console.error("❌ FATAL: Private Key missing."); process.exit(1); }
    const cleanKey = rawKey.trim();

    try {
        // B. DUAL-PROVIDER SETUP
        // We use HTTP for all logic to prevent "WebSocket Closed" errors during execution
        const httpProvider = new JsonRpcProvider(CONFIG.RPC_URL);
        const wsProvider = new WebSocketProvider(CONFIG.WSS_URL);
        const signer = new Wallet(cleanKey, httpProvider);
        
        await wsProvider.ready;
        console.log(`✅ SYSTEMS ONLINE | WALLET: ${signer.address}`);

        // C. CONTRACTS (Mapped to HTTP for stability)
        const poolContract = new Contract(CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], httpProvider);
        const oracleContract = new Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], httpProvider);
        const priceFeed = new Contract(CONFIG.CHAINLINK_FEED, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], httpProvider);
        const titanIface = new Interface(["function requestTitanLoan(address,uint256,address[])"]);

        // D. PRICE TRACKER (Updates every block automatically)
        wsProvider.on("block", async (blockNum) => {
            try {
                const [, price] = await priceFeed.latestRoundData();
                currentEthPrice = Number(price) / 1e8;
                process.stdout.write(`\r⛓️ BLOCK: ${blockNum} | ETH: $${currentEthPrice.toFixed(2)} | Whale Striker Hunting... `);
            } catch (e) { /* Ignore price fetch errors */ }
        });

        // E. THE STRATEGY (Whale Listener)
        wsProvider.on({ address: CONFIG.WETH_USDC_POOL }, async (log) => {
            try {
                // 1. LIQUIDITY CHECK (via HTTP)
                const [res0] = await poolContract.getReserves();
                const safeLoan = res0 / 10n; // 10% of Pool Liquidity

                // 2. ENCODE STRIKE DATA
                const strikeData = titanIface.encodeFunctionData("requestTitanLoan", [
                    CONFIG.WETH, safeLoan, [CONFIG.WETH, CONFIG.USDC]
                ]);

                // 3. PRE-FLIGHT SIMULATION + L1 FEE + MARKET GAS
                const [simulation, l1Fee, feeData] = await Promise.all([
                    httpProvider.call({ to: CONFIG.TARGET_CONTRACT, data: strikeData, from: signer.address }).catch(() => null),
                    oracleContract.getL1Fee(strikeData),
                    httpProvider.getFeeData()
                ]);

                if (!simulation) return; // Simulation reverted (No arb opportunity)

                // 4. THE "OMNISCIENT" PROFIT CALCULATION
                // We calculate L1 Data Cost + L2 Execution Cost + Priority Bribe
                const aggressivePriority = (feeData.maxPriorityFeePerGas * (100n + CONFIG.PRIORITY_BRIBE)) / 100n;
                const l2Cost = CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
                const totalCost = l2Cost + l1Fee;
                
                const netProfit = BigInt(simulation) - totalCost;
                
                // 5. DECISION MATRIX
                if (netProfit > ethers.parseEther(CONFIG.MARGIN_ETH)) {
                    const profitUSD = parseFloat(ethers.formatEther(netProfit)) * currentEthPrice;
                    
                    console.log(`\n🚨 WHALE GAP FOUND! Profit: ${ethers.formatEther(netProfit)} ETH (~$${profitUSD.toFixed(2)})`);
                    
                    // 6. EXECUTE (First-to-Mine Bribe)
                    const tx = await signer.sendTransaction({
                        to: CONFIG.TARGET_CONTRACT,
                        data: strikeData,
                        gasLimit: CONFIG.GAS_LIMIT,
                        maxFeePerGas: feeData.maxFeePerGas,
                        maxPriorityFeePerGas: aggressivePriority, // Bribing the validator
                        type: 2
                    });
                    
                    console.log(`🚀 STRIKE FIRED: ${tx.hash}`);
                }
            } catch (e) {
                // Silence simulation errors (Normal in MEV)
            }
        });

        // F. IMMORTALITY PROTOCOL
        wsProvider.websocket.onclose = () => {
            console.warn("\n⚠️ CONNECTION LOST. REBOOTING...");
            process.exit(1); // Triggers PM2/Docker restart immediately
        };

    } catch (e) {
        console.error(`\n❌ CRITICAL ERROR: ${e.message}`);
        setTimeout(startUltimateWhaleStriker, 1000);
    }
}

// EXECUTE
if (require.main === module) {
    startUltimateWhaleStriker().catch(e => {
        console.error("FATAL ERROR. RESTARTING...");
        setTimeout(startUltimateWhaleStriker, 1000);
    });
}
