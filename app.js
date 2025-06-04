const LOTTERY_CONTRACT_ADDRESS = '0x28F277ca151E487A23509529Ced8A5112d6fd37b';

const CHAIN_EXPLORER = 'https://bscscan.com/address/'; 
const LOTTERY_ABI = [
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

function updateStatusIndicator(status, message) {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) return;
    
    switch (status) {
        case 'loading':
            indicator.innerHTML = '🔄 加载中...';
            indicator.style.color = '#f59e0b';
            indicator.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
            indicator.style.borderColor = 'rgba(245, 158, 11, 0.2)';
            break;
        case 'connected':
            indicator.innerHTML = '🟢 实时连接';
            indicator.style.color = '#10b981';
            indicator.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            indicator.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            break;
        case 'wallet-connected':
            indicator.innerHTML = `👛 ${message}`;
            indicator.style.color = '#10b981';
            indicator.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            indicator.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            break;
        case 'error':
            indicator.innerHTML = '🔴 连接失败';
            indicator.style.color = '#ef4444';
            indicator.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            indicator.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            break;
        case 'wallet':
            indicator.innerHTML = '👛 请连接钱包';
            indicator.style.color = '#8b5cf6';
            indicator.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
            indicator.style.borderColor = 'rgba(139, 92, 246, 0.2)';
            break;
    }
}

function animateJackpot(amount) {
    const jackpotElement = document.getElementById('jackpot-amount');
    const currentAmount = parseFloat(jackpotElement.textContent.replace(/[,，]/g, '')) || 0;
    const targetAmount = parseFloat(amount);
    
    if (currentAmount !== targetAmount) {
        let start = currentAmount;
        const increment = (targetAmount - start) / 30; // 30帧动画
        let frame = 0;
        
        function animate() {
            if (frame < 30) {
                start += increment;
                jackpotElement.textContent = Number(start).toLocaleString('zh-CN', { 
                    maximumFractionDigits: 2, 
                    minimumFractionDigits: 2 
                });
                frame++;
                requestAnimationFrame(animate);
            } else {
                jackpotElement.textContent = Number(targetAmount).toLocaleString('zh-CN', { 
                    maximumFractionDigits: 2, 
                    minimumFractionDigits: 2 
                });
            }
        }
        animate();
    }
}

async function connectWallet() {
    if (window.ethereum) {
        try {
            updateStatusIndicator('loading', '正在连接钱包...');
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            updateStatusIndicator('connected', '钱包已连接');
            return accounts[0];
        } catch (err) {
            updateStatusIndicator('error', '用户拒绝连接');
            alert('请授权钱包访问以获取完整功能');
            return null;
        }
    } else {
        updateStatusIndicator('wallet', '未安装钱包');
        alert('请先安装MetaMask等以太坊钱包插件');
        return null;
    }
}

async function loadLotteryInfo() {
    try {
        updateStatusIndicator('loading', '正在获取数据...');
        
        if (!window.ethereum) {
            updateStatusIndicator('wallet', '未安装钱包');
            document.getElementById('user-weight').innerText = '请安装钱包';
            return;
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const userAddress = accounts[0];

        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(LOTTERY_ABI, LOTTERY_CONTRACT_ADDRESS);

        const result = await contract.methods.getAllInfo(userAddress).call();
        // result[0]: info(uint256[])
        // result[1]: winners(address[])
        // result[2]: winnersWinning(uint256[])
        const info = result[0];
        const winners = result[1];
        const winnersWinning = result[2];

        const jackpotAmount = Number(web3.utils.fromWei(info[6], 'ether'));
        animateJackpot(jackpotAmount);

        const lastDraw = new Date(Number(info[4]) * 1000);
        const now = new Date();
        const isRecent = (now - lastDraw) < 3600000; // 1小时内
        
        document.getElementById('last-draw-time').innerText = lastDraw.toLocaleString('zh-CN');
        document.getElementById('total-weight').innerText = Number(info[1]).toLocaleString('zh-CN');
        document.getElementById('user-weight').innerText = Number(info[0]).toLocaleString('zh-CN');

        const winnersList = document.getElementById('winners-list');
        winnersList.innerHTML = '';
        
        if (winners.length === 0) {
            winnersList.innerHTML = '<div class="winner-placeholder">🔍 暂无中奖记录</div>';
        } else {
            for (let i = 0; i < Math.min(winners.length, 5); i++) { // 最多显示5个
                const addr = winners[i];
                const winAmount = winnersWinning[i] ? web3.utils.fromWei(winnersWinning[i], 'ether') : 0;
                const div = document.createElement('div');
                div.className = 'winner-address fomo';
                div.innerHTML = `
                    <a href="${CHAIN_EXPLORER}${addr}" target="_blank" title="在区块浏览器中查看">
                        ${addr.slice(0,6)}...${addr.slice(-4)}
                    </a> 
                    <span class="win-amount">+${Number(winAmount).toLocaleString('zh-CN', {maximumFractionDigits:2})} USDT</span>
                `;
                
                div.style.opacity = '0';
                div.style.transform = 'translateY(20px)';
                winnersList.appendChild(div);
                
                setTimeout(() => {
                    div.style.transition = 'all 0.5s ease-out';
                    div.style.opacity = '1';
                    div.style.transform = 'translateY(0)';
                }, i * 100);
            }
        }

        const shortAddress = `${userAddress.slice(0,6)}...${userAddress.slice(-4)}`;
        updateStatusIndicator('wallet-connected', shortAddress);
        
    } catch (e) {
        console.error('获取合约信息失败:', e);
        updateStatusIndicator('error', '获取数据失败');
        
        if (e.message.includes('network')) {
            alert('网络连接错误，请检查网络设置');
        } else if (e.message.includes('contract')) {
            alert('合约连接失败，请检查合约地址');
        } else {
            alert('数据获取失败，请稍后重试');
        }
    }
}

function startAutoRefresh() {
    setInterval(async () => {
        try {
            await loadLotteryInfo();
        } catch (e) {
            console.error('自动刷新失败:', e);
        }
    }, 30000);
}

window.addEventListener('DOMContentLoaded', () => {
    if (typeof window.Web3 === 'undefined') {
        const script = document.createElement('script');
        script.src = './web3.min.js';
        script.onload = () => {
            loadLotteryInfo();
            startAutoRefresh();
        };
        script.onerror = () => {
            updateStatusIndicator('error', 'Web3加载失败');
            alert('Web3.js 加载失败，请检查网络连接');
        };
        document.body.appendChild(script);
    } else {
        loadLotteryInfo();
        startAutoRefresh();
    }

    // 监听账户变化
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                loadLotteryInfo();
            } else {
                updateStatusIndicator('wallet', '请连接钱包');
            }
        });

        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    }
}); 
