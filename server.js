// ===============================================================================
// APEX ULTIMATE MASTER v62.0 (STATIC SHARDED) - HIGH-FREQUENCY CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS (PREVENTS REJECTION CRASHES) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    // v62.0: Aggressive suppression of RPC Handshake noise to prevent container reboots
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe') || msg.includes('infura')) return; 
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe') || msg.includes('infura')) return;
    console.error("\n\x1b[31m[UNHANDLED REJECTION]\x1b[0m", msg);
});

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // 🚦 TRAFFIC CONTROL (v62.0 STATIC SHARDED)
    MEMPOOL_SAMPLE_RATE: 0.015,          
    WORKER_BOOT_DELAY_MS: 45000,         // 45s Master Stagger (Mandatory for 48-core system)
    HEARTBEAT_INTERVAL_MS: 180000,       // 3m Heartbeat
    RPC_COOLDOWN_MS: 60000,              
    RATE_LIMIT_SLEEP_MS: 600000,         // 10m Deep Sleep if 429 persists
    
    // 🐋 OMNISCIENT & TRIANGLE SETTINGS (v40.0)
    WHALE_THRESHOLD: parseEther("15.0"), 
    LEVIATHAN_MIN_ETH: parseEther("10.0"),
    GAS_LIMIT: 1250000n,
    MARGIN_ETH: "0.015",
    PRIORITY_BRIBE: 15n,
    CROSS_CHAIN_PROBE: true,

    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: "https://mainnet.infura.io/v3/e601dc0b8ff943619576956539dd3b82",
            wss: "wss://mainnet.infura.io/ws/v3/e601dc0b8ff943619576956539dd3b82", 
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            color: TXT.cyan
        },
        {
            name: "BASE_L2",
            chainId: 8453,
            rpc: "https://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            wss: "wss://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            gasOracle: "0x420000000000000000000000000000000000000F",
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            color: TXT.magenta
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: "https://arb1.arbitrum.io/rpc",
            wss: "wss://arb1.arbitrum.io/feed",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            color: TXT.blue
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v62.0 | ULTIMATE STATIC MASTER       ║
║   STRATEGY: HANDSHAKE BYPASS + TRI-DIVISION SHARDING ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const cpuCount = Math.min(os.cpus().length, 48); 
    console.log(`${TXT.cyan}[SYSTEM] Linear Queue Boot for ${cpuCount} Cores (45s window)...${TXT.reset}`);

    const spawnWorker = (i) => {
        if (i >= cpuCount) return;
        cluster.fork();
        setTimeout(() => spawnWorker(i + 1), GLOBAL_CONFIG.WORKER_BOOT_DELAY_MS);
    };

    spawnWorker(0);

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core Offline. Ghost Mode Resting (120s)...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 120000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    
    // v62.0 Linear Stagger: worker 48 waits significantly longer
    const startDelay = (cluster.worker.id % 24) * 12000;
    setTimeout(() => {
        initWorker(NETWORK).catch(() => {});
    }, startDelay);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    
    // DIVISION SHARDING: 0 = Sniper (Mempool), 1 = Decoder (Logs), 2 = Monitor (Active)
    const DIVISION = (cluster.worker.id % 3);
    const ROLE_NAME = ["SNIPER", "DECODER", "MONITOR"][DIVISION];
    
    let isProcessing = false;
    let cachedFeeData = null;
    let currentEthPrice = 0;
    let scanCount = 0;
    let retryCount = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
    const walletKey = rawKey.trim();

    async function safeConnect() {
        if (retryCount >= 100) return;

        try {
            // v62.0 FIX: Pass hardcoded Network object AND use staticNetwork: true
            // This is the absolute fix for the eth_chainId "coalesce" crash.
            const netObj = ethers.Network.from(CHAIN.chainId);
            const provider = new JsonRpcProvider(CHAIN.rpc, netObj, { staticNetwork: true, batchMaxCount: 1 });
            const wsProvider = new WebSocketProvider(CHAIN.wss, netObj);
            
            wsProvider.on('error', (e) => {
                if (e.message.includes("429") || e.message.includes("coalesce") || e.message.includes("infura")) {
                   process.stdout.write(`${TXT.red}!${TXT.reset}`);
                }
            });

            if (wsProvider.websocket) {
                wsProvider.websocket.onclose = () => {
                    console.log(`${TAG} ${TXT.yellow}⚠️ WS DROP. Core entering ghost mode...${TXT.reset}`);
                    setTimeout(safeConnect, 60000);
                };
            }

            const wallet = new Wallet(walletKey, provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider) : null;
            const poolContract = CHAIN.chainId === 8453 ? new Contract(GLOBAL_CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], provider) : null;

            // Heartbeat Logic (3m intervals)
            setInterval(async () => {
                if (isProcessing) return;
                try {
                    const [fees, [, price]] = await Promise.all([
                        provider.getFeeData().catch(() => null),
                        priceFeed.latestRoundData().catch(() => [0, 0])
                    ]);
                    if (fees) cachedFeeData = fees;
                    if (price) currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, GLOBAL_CONFIG.HEARTBEAT_INTERVAL_MS + (Math.random() * 60000));

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} SYNCED (${ROLE_NAME}) on ${TAG}${TXT.reset}`);

            const titanIface = new Interface([
                "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)",
                "function executeTriangle(address[] path, uint256 amount)"
            ]);

            // v62.0 DIVISIONAL SUBSCRIPTION LOGIC
            setTimeout(() => {
                if (DIVISION === 0) {
                    // SNIPER: MEMPOOL WHALE SNIPING
                    wsProvider.on("pending", async (txHash) => {
                        if (isProcessing) return;
                        if (Math.random() > GLOBAL_CONFIG.MEMPOOL_SAMPLE_RATE) return; 

                        try {
                            scanCount++;
                            if (scanCount % 500 === 0 && (cluster.worker.id % 12 === 0)) {
                               process.stdout.write(`\r${TAG} Sniper Division | Listening... Txs: ${scanCount}${TXT.reset}`);
                            }

                            isProcessing = true;
                            const tx = await provider.getTransaction(txHash).catch(() => null);
                            
                            if (tx && tx.to && tx.value >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                                const isDEXTrade = (tx.to.toLowerCase() === CHAIN.uniswapRouter.toLowerCase());
                                if (isDEXTrade) {
                                    console.log(`\n${TAG} ${TXT.gold}⚡ SNIPER INTERCEPT: ${formatEther(tx.value)} ETH whale!${TXT.reset}`);
                                    await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, "SUMMIT_OMNI", cachedFeeData);
                                }
                            }
                            setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                        } catch (err) { isProcessing = false; }
                    });
                } else if (DIVISION === 1) {
                    // DECODER: BLOCK LOG DECODING (LEVIATHAN)
                    const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                    wsProvider.on({ topics: [swapTopic] }, async (log) => {
                        if (isProcessing) return;
                        try {
                            const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                            const maxSwap = decoded.reduce((max, val) => val > max ? val : max, 0n);

                            if (maxSwap >= GLOBAL_CONFIG.LEVIATHAN_MIN_ETH) {
                                 isProcessing = true;
                                 console.log(`\n${TAG} ${TXT.yellow}🐳 DECODER CONFIRM: ${formatEther(maxSwap)} ETH swap log!${TXT.reset}`);
                                 await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, "LEVIATHAN", cachedFeeData);
                                 setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                            }
                        } catch (e) { isProcessing = false; }
                    });
                } else if (DIVISION === 2) {
                    // MONITOR: TRIANGLE STOCHASTIC PROBES
                    setInterval(async () => {
                        if (isProcessing) return;
                        try {
                            isProcessing = true;
                            await attemptTriangleStrike(provider, wallet, titanIface, gasOracle, currentEthPrice, CHAIN, cachedFeeData);
                            setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                        } catch (e) { isProcessing = false; }
                    }, 120000 + (Math.random() * 60000));
                }
            }, (cluster.worker.id % 48) * 10000); 

        } catch (e) {
            retryCount++;
            const backoff = (e.message.includes("429") || e.message.includes("coalesce")) ? GLOBAL_CONFIG.RATE_LIMIT_SLEEP_MS : (30000 * retryCount);
            process.stdout.write(`${TXT.red}?${TXT.reset}`);
            setTimeout(safeConnect, backoff);
        }
    }

    await safeConnect();
}

async function attemptStrike(provider, wallet, iface, gasOracle, pool, ethPrice, CHAIN, mode, feeData) {
    try {
        const balanceWei = await provider.getBalance(wallet.address).catch(() => 0n);
        const balanceEth = parseFloat(formatEther(balanceWei));
        
        // v40.0 Binary Wealth Scaling
        let loanAmount = balanceEth > 0.1 ? parseEther("100") : parseEther("25");

        if (pool && CHAIN.chainId === 8453) {
            const [res0] = await pool.getReserves().catch(() => [0n]);
            const poolLimit = BigInt(res0) / 10n; // 10% Depth Rule (v40.0)
            if (loanAmount > poolLimit) loanAmount = poolLimit;
        }

        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            GLOBAL_CONFIG.WETH, loanAmount, [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC]
        ]);

        await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, mode, feeData);
    } catch (e) {}
}

async function attemptTriangleStrike(provider, wallet, iface, gasOracle, ethPrice, CHAIN, feeData) {
    try {
        const loanAmount = parseEther("25");
        const paths = [[GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.CBETH, GLOBAL_CONFIG.WETH]];
        const strikeData = iface.encodeFunctionData("executeTriangle", [paths[0], loanAmount]);
        await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, "TRIANGLE", feeData);
    } catch (e) {}
}

async function executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, mode, feeData) {
    try {
        const currentFees = feeData || await provider.getFeeData().catch(() => null);
        if (!currentFees) return false;

        const [simulation, l1Fee] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: strikeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            gasOracle ? gasOracle.getL1Fee(strikeData).catch(() => 0n) : 0n
        ]);

        if (!simulation) return false;

        const aaveFee = (loanAmount * 5n) / 10000n;
        const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * (currentFees.maxFeePerGas || currentFees.gasPrice);
        const marginWei = parseEther(GLOBAL_CONFIG.MARGIN_ETH);
        
        const totalThreshold = l2Cost + l1Fee + aaveFee + marginWei;
        const rawProfit = BigInt(simulation);

        if (rawProfit > totalThreshold) {
            const netProfit = rawProfit - totalThreshold;
            console.log(`\n${TXT.green}${TXT.bold}✅ BLOCK DOMINATED! +${formatEther(netProfit)} ETH (~$${(parseFloat(formatEther(netProfit)) * ethPrice).toFixed(2)})${TXT.reset}`);

            let aggressivePriority = (currentFees.maxPriorityFeePerGas * 150n) / 100n;

            const txPayload = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT,
                data: strikeData,
                type: 2,
                chainId: CHAIN.chainId,
                maxFeePerGas: currentFees.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                nonce: await provider.getTransactionCount(wallet.address).catch(() => 0),
                value: 0n
            };

            const signedTx = await wallet.signTransaction(txPayload);
            const relayUrl = CHAIN.privateRpc || CHAIN.rpc;
            
            const relayResponse = await axios.post(relayUrl, {
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
            }, { timeout: 2000 }).catch(() => null);

            if (relayResponse && relayResponse.data && relayResponse.data.result) {
                console.log(`   ${TXT.green}✨ SUCCESS: ${relayResponse.data.result}${TXT.reset}`);
                console.log(`   ${TXT.bold}${TXT.gold}💰 SECURED BY: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                process.exit(0);
            } else {
                await wallet.sendTransaction(txPayload).catch(() => {});
            }
            return true;
        }
    } catch (e) {}
    return false;
}
