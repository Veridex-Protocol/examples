// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MockERC20
 * @dev Simple ERC20 token for testing
 */
contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }
    
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: insufficient allowance");
        _allowances[from][msg.sender] = currentAllowance - amount;
        _transfer(from, to, amount);
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(_balances[from] >= amount, "ERC20: insufficient balance");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/**
 * @title MockERC721
 * @dev Simple ERC721 token for testing
 */
contract MockERC721 is IERC721 {
    string public name;
    string public symbol;
    
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    uint256 private _nextTokenId;
    
    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }
    
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC721).interfaceId;
    }
    
    function balanceOf(address owner) external view override returns (uint256) {
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) external view override returns (address) {
        return _owners[tokenId];
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external override {
        _transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) external override {
        _transfer(from, to, tokenId);
    }
    
    function transferFrom(address from, address to, uint256 tokenId) external override {
        _transfer(from, to, tokenId);
    }
    
    function approve(address to, uint256 tokenId) external override {
        _tokenApprovals[tokenId] = to;
        emit Approval(msg.sender, to, tokenId);
    }
    
    function setApprovalForAll(address operator, bool approved) external override {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function getApproved(uint256 tokenId) external view override returns (address) {
        return _tokenApprovals[tokenId];
    }
    
    function isApprovedForAll(address owner, address operator) external view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function mint(address to) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = to;
        _balances[to]++;
        emit Transfer(address(0), to, tokenId);
        return tokenId;
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(_owners[tokenId] == from, "ERC721: not owner");
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }
}

/**
 * @title MockERC1155
 * @dev Simple ERC1155 token for testing
 */
contract MockERC1155 is IERC1155 {
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155).interfaceId;
    }
    
    function balanceOf(address account, uint256 id) external view override returns (uint256) {
        return _balances[id][account];
    }
    
    function balanceOfBatch(
        address[] calldata accounts,
        uint256[] calldata ids
    ) external view override returns (uint256[] memory) {
        uint256[] memory batchBalances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            batchBalances[i] = _balances[ids[i]][accounts[i]];
        }
        return batchBalances;
    }
    
    function setApprovalForAll(address operator, bool approved) external override {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address account, address operator) external view override returns (bool) {
        return _operatorApprovals[account][operator];
    }
    
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes calldata
    ) external override {
        require(_balances[id][from] >= value, "ERC1155: insufficient balance");
        _balances[id][from] -= value;
        _balances[id][to] += value;
        emit TransferSingle(msg.sender, from, to, id, value);
    }
    
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata
    ) external override {
        for (uint256 i = 0; i < ids.length; i++) {
            require(_balances[ids[i]][from] >= values[i], "ERC1155: insufficient balance");
            _balances[ids[i]][from] -= values[i];
            _balances[ids[i]][to] += values[i];
        }
        emit TransferBatch(msg.sender, from, to, ids, values);
    }
    
    function mint(address to, uint256 id, uint256 amount) external {
        _balances[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }
}

/**
 * @title MockVeridexHub
 * @dev Mock Veridex Hub contract for testing vault verification
 */
contract MockVeridexHub is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    struct Vault {
        bytes32 publicKey;
        bool exists;
        uint256 createdAt;
    }
    
    mapping(address => Vault) public vaults;
    
    event VaultCreated(address indexed vault, bytes32 publicKey);
    event Deposited(address indexed vault, address indexed token, uint256 amount);
    event Withdrawn(address indexed vault, address indexed token, uint256 amount);
    
    /**
     * @dev Create a mock vault for testing
     */
    function createVault(address vaultAddress, bytes32 publicKey) external {
        require(!vaults[vaultAddress].exists, "Vault already exists");
        
        vaults[vaultAddress] = Vault({
            publicKey: publicKey,
            exists: true,
            createdAt: block.timestamp
        });
        
        emit VaultCreated(vaultAddress, publicKey);
    }
    
    /**
     * @dev Check if an address is a valid vault
     */
    function isVault(address vaultAddress) external view returns (bool) {
        return vaults[vaultAddress].exists;
    }
    
    /**
     * @dev Get vault info
     */
    function getVault(address vaultAddress) external view returns (
        bytes32 publicKey,
        bool exists,
        uint256 createdAt
    ) {
        Vault storage vault = vaults[vaultAddress];
        return (vault.publicKey, vault.exists, vault.createdAt);
    }
    
    /**
     * @dev Deposit ETH to vault
     */
    function depositETH(address vault) external payable nonReentrant {
        require(vaults[vault].exists, "Vault does not exist");
        
        (bool success, ) = vault.call{value: msg.value}("");
        require(success, "ETH transfer failed");
        
        emit Deposited(vault, address(0), msg.value);
    }
    
    /**
     * @dev Deposit ERC20 to vault
     */
    function depositERC20(address vault, address token, uint256 amount) external nonReentrant {
        require(vaults[vault].exists, "Vault does not exist");
        
        IERC20(token).safeTransferFrom(msg.sender, vault, amount);
        
        emit Deposited(vault, token, amount);
    }
}
