// ===============================================================================
// APEX ULTIMATE OMNISCIENT SNIPER v26.1 (MERGED) - HIGH-FREQUENCY CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, WebSocketProvider, JsonRpcProvider, Wallet, Interface, parseEther, formatEther, Contract, AbiCoder } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    console.error("\n\x1b[31m[CRITICAL ERROR] Uncaught Exception:\x1b[0m", err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("\n\x1b[31m[CRITICAL ERROR] Unhandled Rejection:\x1b[0m", reason instanceof Error ? reason.message : reason);
});

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.error("\x1b[33m%s\x1b[0m", "\n⚠️ WARNING: Flashbots dependency missing. Mainnet bundling disabled.");
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: process.env.BENEFICIARY || "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    
    // ASSETS & POOLS
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    CBETH: "0x2Ae3F1Ec7F1F5563a3d161649c025dac7e983970",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",

    // STRATEGY SETTINGS
    WHALE_THRESHOLD: parseEther("15.0"), // 15 ETH Trigger
    MIN_LOG_ETH: parseEther("10.0"),      // Leviathan Confirmation
    GAS_LIMIT: 1250000n,                 // v26.0 Optimized Limit
    PORT: process.env.PORT || 8080,
    MARGIN_ETH: process.env.MARGIN_ETH || "0.015", // v26.0 Margin
    PRIORITY_BRIBE: 15n,                 // 15% Tip (v26.0)

    // 🌍 NETWORKS
    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: process.env.ETH_RPC || "https://eth.llamarpc.com",
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS",
            relay: "https://relay.flashbots.net",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            gasOracle: null,
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            color: TXT.cyan
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc",
            wss: process.env.ARB_WSS || "wss://arb1.arbitrum.io/feed",
            type: "PRIVATE_RELAY",
            privateRpc: "https://arb1.arbitrum.io/rpc",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            gasOracle: null,
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            color: TXT.blue
        },
        {
            name: "BASE_MAINNET",
            chainId: 8453,
            rpc: process.env.BASE_RPC || "https://mainnet.base.org",
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com",
            type: "PRIVATE_RELAY",
            privateRpc: "https://base.merkle.io",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            gasOracle: "0x420000000000000000000000000000000000000F",
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            color: TXT.magenta
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ APEX ULTIMATE MASTER v26.1 | CLUSTER EDITION      ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   MODE: OMNISCIENT SNIPE + POOL-DEPTH + HEARTBEAT     ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const cpuCount = os.cpus().length;
    console.log(`${TXT.green}[SYSTEM] Booting Multi-Core Engines (${cpuCount} cores)...${TXT.reset}`);
    console.log(`${TXT.cyan}[CONFIG] Target Locked: ${GLOBAL_CONFIG.TARGET_CONTRACT}${TXT.reset}\n`);

    for (let i = 0; i < cpuCount; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️  Worker ${worker.process.pid} died. Respawning...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 3000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    initWorker(NETWORK).catch(err => {
        console.error(`${TXT.red}[FATAL] Worker Boot Error:${TXT.reset}`, err.message);
        process.exit(1);
    });
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    
    // 0. JITTER
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000)));

    // 1. HEALTH SERVER
    try {
        const server = http.createServer((req, res) => {
            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "ONLINE", chain: CHAIN.name, mode: "ULTIMATE_v26" }));
            } else { res.writeHead(404); res.end(); }
        });
        server.on('error', () => {});
        server.listen(GLOBAL_CONFIG.PORT + cluster.worker.id); 
    } catch (e) {}

    // 2. KEY SANITIZATION (v24.0 Fix)
    let rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
    const cleanKey = rawKey.trim();
    if (cleanKey.length !== 66 && cleanKey.length !== 64) {
        throw new Error(`Invalid Key Length: ${cleanKey.length}.`);
    }
    
    // 3. PROVIDERS & CONTRACTS
    let provider, wsProvider, wallet, gasOracle, priceFeed, poolContract;
    let currentEthPrice = 0;
    let scanCount = 0;

    try {
        const network = ethers.Network.from(CHAIN.chainId);
        provider = new JsonRpcProvider(CHAIN.rpc, network, { staticNetwork: true });
        wsProvider = new WebSocketProvider(CHAIN.wss);
        
        wsProvider.on('error', (error) => {
            if (error && error.message && (error.message.includes("UNEXPECTED_MESSAGE") || error.message.includes("delayedMessagesRead"))) return;
            console.error(`${TXT.yellow}⚠️ [WS ERROR] ${TAG}: ${error.message}${TXT.reset}`);
        });

        if (wsProvider.websocket) {
            wsProvider.websocket.onerror = () => {};
            wsProvider.websocket.onclose = () => {
                console.log(`${TXT.red}⚠️  SOCKET CLOSED [${CHAIN.name}]. Worker rebooting...${TXT.reset}`);
                process.exit(1);
            };
        }
        
        wallet = new Wallet(cleanKey, provider);

        // ORACLES
        if (CHAIN.gasOracle) gasOracle = new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider);
        if (CHAIN.priceFeed) {
            priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            try {
                const [, price] = await priceFeed.latestRoundData();
                currentEthPrice = Number(price) / 1e8;
            } catch(e) {}
        }
        
        // POOL CONTRACT (v26.0 Depth Check)
        if (CHAIN.chainId === 8453) {
            poolContract = new Contract(GLOBAL_CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], provider);
        }

        // 4. HEARTBEAT & PRICE LOOP (v24.0 Monitor)
        setInterval(async () => {
            try {
                await wsProvider.getBlockNumber(); 
                if (priceFeed) {
                    const [, price] = await priceFeed.latestRoundData();
                    currentEthPrice = Number(price) / 1e8;
                }
            } catch (e) {
                console.log(`${TXT.red}💔 HEARTBEAT FAILED on ${TAG}. RESTARTING...${TXT.reset}`);
                process.exit(1);
            }
        }, 12000);
        
        console.log(`${TXT.green}✅ ENGINE ${cluster.worker.id} ACTIVE${TXT.reset} on ${TAG}`);
    } catch (e) {
        console.log(`${TXT.red}❌ Init Failed on ${TAG}: ${e.message}${TXT.reset}`);
        return;
    }

    const titanIface = new Interface([
        "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)",
        "function executeTriangle(address[] path, uint256 amount)"
    ]);

    let flashbotsProvider = null;
    if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
        try {
            const authSigner = new Wallet(wallet.privateKey, provider);
            flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, CHAIN.relay);
        } catch (e) {}
    }

    // 5. ULTIMATE SNIPER ENGINE
    wsProvider.on("pending", async (txHash) => {
        try {
            scanCount++;
            if (scanCount % 25 === 0 && (cluster.worker.id % 6 === 0)) {
               process.stdout.write(`\r${TAG} ${TXT.blue}⚡ SCANNING${TXT.reset} | Txs: ${scanCount} | ETH: $${currentEthPrice.toFixed(2)} `);
            }

            if (!provider) return;
            const tx = await provider.getTransaction(txHash).catch(() => null);
            if (!tx || !tx.to) return;

            const valueWei = tx.value || 0n;
            
            // Trigger 1: Omniscient Whale Spied
            if (valueWei >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                console.log(`\n${TAG} ${TXT.magenta}🚨 OMNISCIENT WHALE DETECTED: ${formatEther(valueWei)} ETH | Hash: ${txHash.substring(0, 10)}...${TXT.reset}`);
                await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, flashbotsProvider, "OMNISCIENT");
            }
            
            // Trigger 2: Triangle Volatility Probe
            if (Math.random() > 0.9998) {
                await attemptTriangleStrike(provider, wallet, titanIface, gasOracle, currentEthPrice, CHAIN, flashbotsProvider);
            }
        } catch (err) {}
    });

    const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
    wsProvider.on({ topics: [swapTopic] }, async (log) => {
        try {
            const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
            const maxSwap = decoded.reduce((max, val) => val > max ? val : max, 0n);

            if (maxSwap >= GLOBAL_CONFIG.MIN_LOG_ETH) {
                 console.log(`\n${TAG} ${TXT.yellow}🐳 LEVIATHAN LOG CONFIRMED: ${formatEther(maxSwap)} ETH${TXT.reset}`);
                 await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, flashbotsProvider, "LEVIATHAN");
            }
        } catch (e) {}
    });
}

// --- STRIKE LOGIC ---
async function attemptStrike(provider, wallet, iface, gasOracle, pool, ethPrice, CHAIN, flashbotsProvider, mode) {
    try {
        let loanAmount;

        // v26.1 DUAL SCALING (Pool Depth + Wealth)
        if (pool && CHAIN.chainId === 8453) {
            try {
                const [res0] = await pool.getReserves();
                loanAmount = BigInt(res0) / 10n; // 10% Pool Reserve Rule (v26.0)
            } catch (e) {
                loanAmount = parseEther("25");
            }
        } else {
            const balanceWei = await provider.getBalance(wallet.address);
            loanAmount = balanceWei > parseEther("0.1") ? parseEther("100") : parseEther("25");
        }

        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            GLOBAL_CONFIG.WETH, 
            loanAmount,
            [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC]
        ]);

        await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, flashbotsProvider, mode);
    } catch (e) {}
}

async function attemptTriangleStrike(provider, wallet, iface, gasOracle, ethPrice, CHAIN, flashbotsProvider) {
    try {
        const loanAmount = parseEther("25"); 
        const paths = [
            [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.CBETH, GLOBAL_CONFIG.WETH],
            [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.CBETH, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.WETH]
        ];

        for (const path of paths) {
            const strikeData = iface.encodeFunctionData("executeTriangle", [path, loanAmount]);
            const success = await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, flashbotsProvider, "TRIANGLE");
            if (success) break;
        }
    } catch (e) {}
}

// --- UNIFIED EXECUTION INTERNAL ---
async function executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, flashbotsProvider, mode) {
    try {
        const [simulation, l1Fee, feeData] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: strikeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            gasOracle ? gasOracle.getL1Fee(strikeData).catch(() => 0n) : 0n,
            provider.getFeeData()
        ]);

        if (!simulation) return false;

        const aaveFee = (loanAmount * 5n) / 10000n;
        const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
        const marginWei = parseEther(GLOBAL_CONFIG.MARGIN_ETH);
        
        const totalCostThreshold = l2Cost + l1Fee + aaveFee + marginWei;
        const rawProfit = BigInt(simulation);

        if (rawProfit > totalCostThreshold) {
            const cleanProfitEth = rawProfit - (l2Cost + l1Fee + aaveFee);
            console.log(`\n${TXT.green}${TXT.bold}💎 ${mode} STRIKE AUTHORIZED${TXT.reset} | Est. Net: ${formatEther(cleanProfitEth)} ETH`);

            // v26.0 Bribe Optimization (15%)
            const aggressivePriority = feeData.maxPriorityFeePerGas + 
                ((feeData.maxPriorityFeePerGas * GLOBAL_CONFIG.PRIORITY_BRIBE) / 100n);

            const txPayload = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT,
                data: strikeData,
                type: 2,
                chainId: CHAIN.chainId,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                nonce: await provider.getTransactionCount(wallet.address),
                value: 0n
            };

            const signedTx = await wallet.signTransaction(txPayload);

            if (CHAIN.type === "FLASHBOTS" && flashbotsProvider) {
                const bundle = [{ signedTransaction: signedTx }];
                await flashbotsProvider.sendBundle(bundle, (await provider.getBlockNumber()) + 1);
                console.log(`   ${TXT.green}🎉 Private Bundle Dispatched (Mainnet)${TXT.reset}`);
            } else {
                const relayResponse = await axios.post(CHAIN.privateRpc || CHAIN.rpc, {
                    jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
                }, { timeout: 2000 }).catch(() => null);

                if (relayResponse && relayResponse.data && relayResponse.data.result) {
                    console.log(`   ${TXT.green}🎉 SUCCESS: ${relayResponse.data.result}${TXT.reset}`);
                    console.log(`   ${TXT.bold}💸 FUNDS SECURED AT: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                    process.exit(0);
                } else {
                    await wallet.sendTransaction(txPayload).catch(() => {});
                }
            }
            return true;
        }
    } catch (e) {}
    return false;
}
