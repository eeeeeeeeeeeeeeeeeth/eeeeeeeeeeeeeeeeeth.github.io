const LOTTERY_CONTRACT_ADDRESS = '0x2823d4df54A006E221490aF800bf6D81c75690B4';
const CHAIN_EXPLORER = 'https://etherscan.io/address/'; 
const LOTTERY_ABI = [
    // Only contains getAllInfo ABI fragment
    {
        "inputs": [
            { "internalType": "address", "name": "user", "type": "address" }
        ],
        "name": "getAllInfo",
        "outputs": [
            { "internalType": "uint256[]", "name": "", "type": "uint256[]" },
            { "internalType": "address[]", "name": "", "type": "address[]" },
            { "internalType": "uint256[]", "name": "", "type": "uint256[]" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

async function connectWallet() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            return accounts[0];
        } catch (err) {
            alert('Please authorize wallet access');
            return null;
        }
    } else {
        alert('Please install MetaMask or other Ethereum wallet extension first');
        return null;
    }
}

async function loadLotteryInfo() {
    if (!window.ethereum) {
        alert('Please install MetaMask or other Ethereum wallet extension first');
        return;
    }
    // Connect wallet
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const userAddress = accounts[0];

    // Initialize Web3 with window.ethereum
    const web3 = new Web3(window.ethereum);
    const contract = new web3.eth.Contract(LOTTERY_ABI, LOTTERY_CONTRACT_ADDRESS);

    try {
        const result = await contract.methods.getAllInfo(userAddress).call();

        const info = result[0];
        const winners = result[1];
        const winnersWinning = result[2];

        const ethAmount = Number(web3.utils.fromWei(info[6], 'ether'));
        document.getElementById('jackpot-amount').innerText = `${ethAmount.toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 4 })} ETH ($${(ethAmount * 2624.59).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })})`;

        // Info section
        const lastDraw = new Date(Number(info[4]) * 1000);
        document.getElementById('last-draw-time').innerText = lastDraw.toLocaleString('en-US');
        document.getElementById('total-weight').innerText = Number(info[1]).toLocaleString('en-US');
        document.getElementById('user-weight').innerText = Number(info[0]).toLocaleString('en-US');

        // Winner list
        const winnersList = document.getElementById('winners-list');
        winnersList.innerHTML = '';
        if (winners.length === 0) {
            winnersList.innerHTML = '<div class="winner-placeholder">No Data</div>';
        } else {
            for (let i = 0; i < winners.length; i++) {
                const addr = winners[i];
                const winAmount = winnersWinning[i] ? web3.utils.fromWei(winnersWinning[i], 'ether') : 0;
                const div = document.createElement('div');
                div.className = 'winner-address fomo';
                div.innerHTML = `<a href="${CHAIN_EXPLORER}${addr}" target="_blank" title="View on Explorer">${addr.slice(0,6)}...${addr.slice(-4)}</a> <span class="win-amount">+${Number(winAmount).toLocaleString('en-US', {maximumFractionDigits:4})} ETH ($${(winAmount * 2624.59).toLocaleString('en-US', {maximumFractionDigits:2, minimumFractionDigits:2})})</span>`;
                winnersList.appendChild(div);
            }
        }
    } catch (e) {
        console.error(e);
        alert('Failed to fetch contract info, please check network and contract address');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // Check web3.js
    if (typeof window.Web3 === 'undefined') {
        const script = document.createElement('script');
        script.src = './web3.min.js';
        script.onload = loadLotteryInfo;
        document.body.appendChild(script);
    } else {
        loadLotteryInfo();
    }
}); 
