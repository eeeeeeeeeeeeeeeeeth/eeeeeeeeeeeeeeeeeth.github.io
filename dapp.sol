// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LotteryPool is Initializable, OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private users;
    mapping(address => uint256) public userWeight;
    uint256 public totalWeight;

    mapping(address => bool) public isWls;

    mapping(uint256 => address[]) public roundWinners;
    address public token;
    address public usd1;

    uint256 public currentRound;
    uint256 public winnersPerRound;
    uint256 public drawInterval;
    uint256 public lastDrawTimestamp;

    // 新增一个变量记录用户中奖金额
    mapping(address => uint256) public userWinning;

    event UserWeightAdded(address indexed user, uint256 weight);
    event WinnersDrawn(uint256 indexed round, address[] winners);
    event WinnersPerRoundChanged(uint256 newWinnersPerRound);
    event UpdateUserWeightRejected(address indexed user, uint256 weight, string reason);
    event DrawWinnersRejected(string reason);

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        currentRound = 1;
        winnersPerRound = 1;
        drawInterval = 1 hours;
        lastDrawTimestamp = (block.timestamp / 3600) * 3600;
        usd1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    }

    function setDrawInterval(uint256 _drawInterval) external onlyOwner {
        drawInterval = _drawInterval;
    }

    modifier onlyToken() {
        require(msg.sender == token, "Only token contract can call this function");
        _;
    }

    function setToken(address _token) external onlyOwner {
        token = _token;
    }

    function setIsWls(address user, bool _isWls) external onlyOwner {
        isWls[user] = _isWls;
    }

    function updateUserWeight(address user, uint256 newWeight) external onlyToken {
        // if (newWeight == 0) {
        //     emit UpdateUserWeightRejected(user, newWeight, "Weight is zero");
        //     return;
        // }
        if (isWls[user]) {
            emit UpdateUserWeightRejected(user, newWeight, "User is WLS");
            return;
        }
        uint256 oldWeight = userWeight[user];
        if (!users.contains(user)) {
            users.add(user);
        }
        userWeight[user] = newWeight;
        if (newWeight > oldWeight) {
            totalWeight += (newWeight - oldWeight);
        } else {
            totalWeight -= (oldWeight - newWeight);
        }
        emit UserWeightAdded(user, newWeight);
    }

    // 设置每期中奖人数
    function setWinnersPerRound(uint256 n) external onlyOwner {
        require(n > 0, "Winners must be positive");
        winnersPerRound = n;
        emit WinnersPerRoundChanged(n);
    }

    // 测试用 正式环境禁用
    function setlastDrawTimestamp(uint256 newValue) external onlyOwner{
        lastDrawTimestamp = newValue;
    }

    function drawWinners() external onlyToken {
        uint256 balance = IERC20(usd1).balanceOf(address(this));
        if (balance == 0){
            return;
        }

        if (block.timestamp < lastDrawTimestamp + drawInterval) {
            emit DrawWinnersRejected("Not time to draw yet");
            return;
        }
        if (totalWeight == 0) {
            emit DrawWinnersRejected("No participants");
            return;
        }
        if (users.length() < winnersPerRound) {
            emit DrawWinnersRejected("Not enough users");
            return;
        }

        address[] memory winners = new address[](winnersPerRound);
        uint256 tempTotalWeight = totalWeight;
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, blockhash(block.number-1))));

        for (uint256 i = 0; i < winnersPerRound; i++) {
            uint256 rand = uint256(keccak256(abi.encodePacked(seed, i))) % tempTotalWeight;
            uint256 acc = 0;
            for (uint256 j = 0; j < users.length(); j++) {
                address user = users.at(j);
                acc += userWeight[user];
                if (rand < acc) {
                    winners[i] = user;
                    tempTotalWeight -= userWeight[user];
                    break;
                }
            }
        }
        roundWinners[currentRound] = winners;
        emit WinnersDrawn(currentRound, winners);
        currentRound++;
        lastDrawTimestamp = (block.timestamp / 1800) * 1800;

        
        if (balance > 0 && winners.length > 0) {
            uint256 perWinner = balance / winners.length;
            for (uint256 i = 0; i < winners.length; i++) {
                IERC20(usd1).transfer(winners[i], perWinner);
                userWinning[winners[i]] += perWinner;
            }
        }
    }

    // 查询某期中奖者
    function getWinners(uint256 round) external view returns (address[] memory) {
        return roundWinners[round];
    }

    // 查询用户权重
    function getUserWeight(address user) external view returns (uint256) {
        return userWeight[user];
    }

    // 查询总权重
    function getTotalWeight() external view returns (uint256) {
        return totalWeight;
    }

    // 查询所有用户
    function getUsers() external view returns (address[] memory) {
        address[] memory allUsers = new address[](users.length());
        for (uint256 i = 0; i < users.length(); i++) {
            allUsers[i] = users.at(i);
        }
        return allUsers;
    }

    // 查询用户人数
    function getUsersCount() external view returns (uint256) {
        return users.length();
    }

    function getAllInfo(address user) external view returns(uint256[] memory, address[] memory, uint256[] memory){
        uint256[] memory info = new uint256[](7);
        info[0] = userWeight[user];
        info[1] = totalWeight;
        info[2] = winnersPerRound;
        info[3] = drawInterval;
        info[4] = lastDrawTimestamp;
        info[5] = currentRound;
        info[6] = IERC20(usd1).balanceOf(address(this));
        
        // 获取过去10期的中奖者
        uint256 rounds = currentRound > 10 ? 10 : currentRound;
        uint256 totalWinners = 0;
        for (uint256 i = 0; i < rounds; i++) {
            totalWinners += roundWinners[currentRound - i].length;
        }
        address[] memory winners = new address[](totalWinners);
        // 把每个中奖者的中奖数量都记录下来
        uint256[] memory winnersWinning = new uint256[](totalWinners);
        uint256 idx = 0;
        for (uint256 i = 0; i < rounds; i++) {
            address[] memory roundWinner = roundWinners[currentRound - i];
            for (uint256 j = 0; j < roundWinner.length; j++) {
                winners[idx] = roundWinner[j];
                winnersWinning[idx] = userWinning[roundWinner[j]];
                idx++;
            }
        }
        
        return (info, winners, winnersWinning);
    }
}
