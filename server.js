// ===============================================================================
// APEX ULTIMATE MASTER v42.0 (ULTIMATE OMNISCIENT SINGULARITY) - NUCLEAR CLUSTER
// ===============================================================================
// MERGE: v26.2 OMNISCIENT + v41.0 POOL-DEPTH CORE + v131.0 NUCLEAR
// DNA: 10% POOL RESERVE RULE + DUAL-VECTOR SNIPE + TRIPLE BROADCAST
// TARGET BENEFICIARY: 0x4B8251e7c80F910305bb81547e301DcB8A596918
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, WebSocketProvider, JsonRpcProvider, Wallet, Interface, parseEther, formatEther, Contract, FallbackProvider, AbiCoder } = require('ethers');
require('dotenv').config();

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.error("\x1b[33m%s\x1b[0m", "⚠️ WARNING: Flashbots missing. Mainnet fallback to private RPC.");
}

// --- AI CONFIGURATION ---
const apiKey = ""; // Environment provided
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
let lastAiCorrection = Date.now();

// --- SAFETY: GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('insufficient funds') || msg.includes('coalesce')) return;
    console.error("\n\x1b[31m[CRITICAL ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network')) return;
});

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- GLOBAL CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    
    // v26.2 ASSETS & POOLS
    WETH_BASE: "0x4200000000000000000000000000000000000006",
    WETH_MAIN: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    CBETH: "0x2Ae3F1Ec7F1F5563a3d161649c025dac7e983970",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",

    // SNIPER SETTINGS (v26.2 Calibrated)
    WHALE_THRESHOLD: parseEther("15.0"), 
    MIN_LOG_ETH: parseEther("10.0"),      
    GAS_LIMIT: 1400000n,                 
    MARGIN_ETH: "0.015",                 // ~$50 Profit Floor
    MIN_PROFIT_BUFFER: "0.005",
    PORT: 8080,

    // AI TUNABLE PARAMETERS
    TUNABLES: {
        MAX_BRIBE_PERCENT: 99.9,
        GAS_PRIORITY_FEE: 1000, 
        GAS_BUFFER_MULT: 1.8 
    },

    RPC_POOL: [
        "https://eth.llamarpc.com",
        "https://1rpc.io/eth",
        "https://rpc.flashbots.net",
        "https://base.llamarpc.com",
        "https://mainnet.base.org",
        "https://arb1.arbitrum.io/rpc",
        "https://base.merkle.io"
    ],

    NETWORKS: [
        { 
            name: "BASE_L2", chainId: 8453, 
            rpc: process.env.BASE_RPC || "https://mainnet.base.org", 
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com", 
            privateRpc: "https://base.merkle.io",
            color: TXT.magenta, gasOracle: "0x420000000000000000000000000000000000000F", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", 
            router: "0x2626664c2603336E57B271c5C0b26F421741e481",
            weth: "0x4200000000000000000000000000000000000006",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"
        },
        { 
            name: "ETH_MAINNET", chainId: 1, 
            rpc: "https://rpc.flashbots.net", 
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS", relay: "https://relay.flashbots.net",
            color: TXT.cyan, priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025"
        },
        {
            name: "ARBITRUM", chainId: 42161,
            rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc",
            wss: process.env.ARB_WSS || "wss://arb1.arbitrum.io/feed",
            color: TXT.blue, priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
        }
    ]
};

// --- AI SELF-HEALING ---
async function askAiForOptimization(errorContext) {
    if (Date.now() - lastAiCorrection < 30000) return; 
    const prompt = `Act as an MEV Cluster Optimizer. Current: ${JSON.stringify(GLOBAL_CONFIG.TUNABLES)}. 
    Failure context: ${errorContext}. Return JSON for MAX_BRIBE_PERCENT, GAS_PRIORITY_FEE, and GAS_BUFFER_MULT.`;
    try {
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        Object.assign(GLOBAL_CONFIG.TUNABLES, JSON.parse(res.data.candidates[0].content.parts[0].text));
        console.log(`${TXT.gold}[AI OPTIMIZER] Cluster parameters recalibrated.${TXT.reset}`);
        lastAiCorrection = Date.now();
    } catch (e) {}
}

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ APEX MASTER v42.0 | ULTIMATE OMNISCIENT CLUSTER  ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   DNA: 10% POOL RESERVE RULE + TRIPLE BROADCAST     ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const nonces = {}; 
    const cpuCount = Math.min(os.cpus().length, 48);
    for (let i = 0; i < cpuCount; i++) {
        const worker = cluster.fork();
        worker.on('message', (msg) => {
            if (msg.type === 'SYNC_RESERVE') {
                if (!nonces[msg.chainId] || msg.nonce > nonces[msg.chainId]) nonces[msg.chainId] = msg.nonce;
                worker.send({ type: 'SYNC_GRANT', nonce: nonces[msg.chainId], chainId: msg.chainId });
                nonces[msg.chainId]++;
            }
            if (msg.type === 'QUANTUM_SIGNAL') {
                for (const id in cluster.workers) cluster.workers[id].send(msg);
            }
            if (msg.type === 'AI_RECALIBRATE') {
                nonces[msg.chainId] = msg.nonce;
                console.log(`${TXT.yellow}[MASTER] Nonce Sync Re-zeroed for ${msg.chainId}${TXT.reset}`);
            }
        });
    }
    cluster.on('exit', () => setTimeout(() => cluster.fork(), 3000));
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    initWorker(GLOBAL_CONFIG.NETWORKS[networkIndex]);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : (cluster.worker.id % 4 === 3 ? "ANALYST" : "STRIKER");
    let currentEthPrice = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
    if (!rawKey) return;
    const walletKey = rawKey.trim();

    // v18.1 HEALTH SERVER INTEGRATION
    try {
        const server = http.createServer((req, res) => {
            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "ACTIVE", role: ROLE, chain: CHAIN.name, mode: "OMNISCIENT_V42" }));
            } else { res.writeHead(404); res.end(); }
        });
        server.on('error', () => {});
        server.listen(GLOBAL_CONFIG.PORT + cluster.worker.id); 
    } catch (e) {}

    async function connect() {
        try {
            const network = ethers.Network.from(CHAIN.chainId);
            const provider = new FallbackProvider(GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
                provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
                priority: i + 1, stallTimeout: 400
            })), network, { quorum: 1 });
            
            const wsProvider = new WebSocketProvider(CHAIN.wss, network);
            wsProvider.on('error', (e) => { if (e && !e.message.includes("UNEXPECTED")) console.error(`${TXT.yellow}⚠️ [WS] ${TAG}: ${e.message}${TXT.reset}`); });

            const wallet = new Wallet(walletKey, provider);
            const titanIface = new Interface([
                "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)",
                "function executeTriangle(address[] path, uint256 amount)"
            ]);

            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;
            const poolContract = CHAIN.chainId === 8453 ? new Contract(GLOBAL_CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], provider) : null;

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} [${ROLE}] READY on ${CHAIN.name}${TXT.reset}`);

            if (ROLE === "ANALYST") {
                const updatePrice = async () => { try { const [, p] = await priceFeed.latestRoundData(); currentEthPrice = Number(p) / 1e8; } catch (e) {} };
                await updatePrice(); setInterval(updatePrice, 20000);
            }

            if (ROLE === "STRIKER") {
                process.on('message', async (msg) => {
                    if (msg.type === 'QUANTUM_SIGNAL' && msg.chainId === CHAIN.chainId) {
                        // Dual-Vector Probe
                        await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, "WHALE");
                        await attemptTriangleStrike(provider, wallet, titanIface, gasOracle, currentEthPrice, CHAIN);
                    }
                });
            }

            if (ROLE === "LISTENER") {
                // LAYER A: PENDING SCANNER
                wsProvider.on("pending", async (txH) => {
                    const tx = await provider.getTransaction(txH).catch(() => null);
                    if (!tx || !tx.to) return;
                    const valWei = tx.value || 0n;
                    if (valWei >= GLOBAL_CONFIG.WHALE_THRESHOLD && tx.to.toLowerCase() === CHAIN.router.toLowerCase()) {
                        console.log(`\n${TAG} ${TXT.magenta}🚨 OMNISCIENT WHALE: ${formatEther(valWei)} ETH${TXT.reset}`);
                        process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId });
                    }
                });

                // LAYER B: LOG DECODER
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                wsProvider.on({ topics: [swapTopic] }, async (log) => {
                    try {
                        const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                        const maxSwap = decoded.reduce((max, val) => val > max ? val : max, 0n);
                        if (maxSwap >= GLOBAL_CONFIG.MIN_LOG_ETH) {
                             console.log(`\n${TAG} ${TXT.yellow}🐳 CONFIRMED LEVIATHAN LOG: ${formatEther(maxSwap)} ETH${TXT.reset}`);
                             process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId });
                        }
                    } catch (e) {}
                });

                wsProvider.on("block", (bn) => {
                    process.send({ type: 'QUANTUM_SIGNAL', chainId: CHAIN.chainId });
                    process.stdout.write(`\r${TAG} ${TXT.cyan}⚡ PEERING BLOCK #${bn} | Heartbeat: ACTIVE ${TXT.reset}`);
                });

                // v26.2 HEARTBEAT MONITOR
                setInterval(async () => {
                    try { await wsProvider.getBlockNumber(); } catch (e) { process.exit(1); }
                }, 12000);
            }
        } catch (e) { setTimeout(connect, 5000); }
    }
    connect();
}

async function getSovereignState(provider, wallet, chainId) {
    return new Promise(async (resolve) => {
        const count = await provider.getTransactionCount(wallet.address, 'latest');
        const listener = (msg) => { if (msg.type === 'SYNC_GRANT' && msg.chainId === chainId) { process.removeListener('message', listener); resolve({ nonce: msg.nonce }); } };
        process.on('message', listener);
        process.send({ type: 'SYNC_RESERVE', nonce: count, chainId: chainId });
    });
}

async function attemptStrike(provider, wallet, iface, oracle, pool, ethPrice, CHAIN, mode) {
    try {
        let loanAmount;
        // v26.2 DUAL SCALING (10% Pool Rule + Wealth Fallback)
        if (pool && CHAIN.chainId === 8453) {
            try {
                const [res0] = await pool.getReserves();
                loanAmount = BigInt(res0) / 10n; // 10% Pool Reserve Rule
            } catch (e) { loanAmount = parseEther("25"); }
        } else {
            const bal = await provider.getBalance(wallet.address);
            loanAmount = parseFloat(formatEther(bal)) > 0.1 ? parseEther("100") : parseEther("25");
        }
        
        const asset = CHAIN.chainId === 8453 ? GLOBAL_CONFIG.WETH_BASE : GLOBAL_CONFIG.WETH_MAIN;
        const data = iface.encodeFunctionData("requestTitanLoan", [asset, loanAmount, [asset, GLOBAL_CONFIG.USDC]]);
        await executeNuclearStrike(provider, wallet, data, loanAmount, oracle, ethPrice, CHAIN, mode);
    } catch (e) {}
}

async function attemptTriangleStrike(provider, wallet, iface, oracle, ethPrice, CHAIN) {
    try {
        const loanAmount = parseEther("25"); 
        const paths = [
            [CHAIN.weth, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.CBETH, CHAIN.weth],
            [CHAIN.weth, GLOBAL_CONFIG.CBETH, GLOBAL_CONFIG.USDC, CHAIN.weth]
        ];
        for (const path of paths) {
            const data = iface.encodeFunctionData("executeTriangle", [path, loanAmount]);
            const hit = await executeNuclearStrike(provider, wallet, data, loanAmount, oracle, ethPrice, CHAIN, "TRIANGLE");
            if (hit) break;
        }
    } catch (e) {}
}

async function executeNuclearStrike(provider, wallet, data, loanAmount, oracle, ethPrice, CHAIN, mode) {
    try {
        const [feeData, balance, state] = await Promise.all([
            provider.getFeeData(),
            provider.getBalance(wallet.address),
            getSovereignState(provider, wallet, CHAIN.chainId)
        ]);

        // PRE-FLIGHT SIMULATION
        const [simulation, l1Fee] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: data, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT, nonce: state.nonce }).catch(() => null),
            oracle ? oracle.getL1Fee(data).catch(() => 0n) : 0n
        ]);

        if (!simulation || simulation === "0x") return false;

        // NUCLEAR PROFIT MATH
        const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || parseEther("1", "gwei");
        const aaveFee = (loanAmount * 5n) / 10000n;
        const totalThreshold = (GLOBAL_CONFIG.GAS_LIMIT * gasPrice) + l1Fee + aaveFee + parseEther(GLOBAL_CONFIG.MARGIN_ETH);

        const rawProfit = BigInt(simulation);

        if (rawProfit > totalThreshold) {
            const cleanProfit = rawProfit - (totalThreshold - parseEther(GLOBAL_CONFIG.MARGIN_ETH));
            console.log(`\n${TXT.green}${TXT.bold}💎 ${mode} STRIKE AUTHORIZED [${CHAIN.name}]${TXT.reset}`);
            console.log(`   ↳ 📐 NET PROFIT: +${formatEther(cleanProfit)} ETH (~$${(parseFloat(formatEther(cleanProfit)) * ethPrice).toFixed(2)})`);

            const priorityBribe = parseEther(GLOBAL_CONFIG.TUNABLES.GAS_PRIORITY_FEE.toString(), "gwei");
            const tx = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT, data: data, type: 2, chainId: CHAIN.chainId,
                maxFeePerGas: gasPrice + priorityBribe, maxPriorityFeePerGas: priorityBribe, 
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT, nonce: state.nonce, value: 0n
            };

            const signedHex = await wallet.signTransaction(tx);

            // NUCLEAR TRIPLE BROADCAST
            if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                const fbSigner = new Wallet(wallet.privateKey, provider);
                const fbProvider = await FlashbotsBundleProvider.create(provider, fbSigner, CHAIN.relay);
                fbProvider.sendBundle([{ signedTransaction: signedHex }], (await provider.getBlockNumber()) + 1);
                console.log(`   ${TXT.green}🎉 Private Bundle Dispatched (Relay)${TXT.reset}`);
            } 
            
            wallet.sendTransaction(tx).catch(e => { if (!e.message.includes("nonce")) askAiForOptimization(`Ethers Error: ${e.message}`); });

            const endpoint = CHAIN.privateRpc || CHAIN.rpc;
            axios.post(endpoint, { 
                jsonrpc: "2.0", id: Date.now() + Math.random(), method: "eth_sendRawTransaction", params: [signedHex] 
            }, { timeout: 1500 }).then(res => {
                if (res.data.result) console.log(`   ${TXT.cyan}⚡ ATOMIC INJECTION ACK: ${res.data.result.substring(0,16)}...${TXT.reset}`);
            }).catch(() => {});

            return true;
        }
    } catch (e) {
        if (e.message.toLowerCase().includes("nonce")) process.send({ type: 'AI_RECALIBRATE', nonce: await provider.getTransactionCount(wallet.address, 'latest'), chainId: CHAIN.chainId });
    }
    return false;
}
