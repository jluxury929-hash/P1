const { ethers, Wallet, WebSocketProvider, Contract, Interface } = require('ethers');
require('dotenv').config();

const CONFIG = {
    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    WSS_URL: process.env.WSS_URL,
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH_USDC_POOL: "0x88A43bb75941904d47401946215162a26bc773dc",
    GAS_ORACLE: "0x420000000000000000000000000000000000000F", // Base L1 Fee Oracle
    WHALE_MIN_ETH: ethers.parseEther("10"), 
    GAS_LIMIT: 950000n,
    MARGIN_ETH: process.env.MARGIN_ETH || "0.01" // Increased default for safety
};

// ABIs
const ORACLE_ABI = ["function getL1Fee(bytes memory _data) public view returns (uint256)"];
const PAIR_ABI = ["function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];

async function startWhaleStriker() {
    const provider = new WebSocketProvider(CONFIG.WSS_URL);
    const signer = new Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
    const poolContract = new Contract(CONFIG.WETH_USDC_POOL, PAIR_ABI, provider);
    const oracleContract = new Contract(CONFIG.GAS_ORACLE, ORACLE_ABI, provider);

    console.log(`\n🔱 APEX TITAN: L1-FEE PROTECTION ACTIVE`);

    provider.on({ address: CONFIG.WETH_USDC_POOL }, async (log) => {
        try {
            // 1. LIQUIDITY CHECK
            const [res0] = await poolContract.getReserves();
            const safeLoan = res0 / 10n; 

            // 2. PREPARE THE STRIKE
            const titanIface = new Interface(["function requestTitanLoan(address,uint256,address[])"]);
            const strikeData = titanIface.encodeFunctionData("requestTitanLoan", [
                CONFIG.WETH, safeLoan, [CONFIG.WETH, CONFIG.USDC]
            ]);

            // 3. SIMULATE GROSS PROFIT
            const simulation = await provider.call({
                to: CONFIG.TARGET_CONTRACT,
                data: strikeData,
                from: signer.address
            });
            const grossProfit = BigInt(simulation);

            // 4. CALCULATE TRUE COSTS (L1 + L2 + Aave)
            const feeData = await provider.getFeeData();
            const l2Cost = CONFIG.GAS_LIMIT * (feeData.maxFeePerGas || feeData.gasPrice);
            
            // Get the "Hidden" L1 Data Fee
            const l1Fee = await oracleContract.getL1Fee(strikeData);
            const aaveFee = (safeLoan * 5n) / 10000n; // 0.05%
            
            const totalCosts = l2Cost + l1Fee + aaveFee;
            const netProfit = grossProfit - totalCosts;

            // 5. THE STRIKE DECISION
            const requiredMargin = ethers.parseEther(CONFIG.MARGIN_ETH);

            if (netProfit > requiredMargin)
