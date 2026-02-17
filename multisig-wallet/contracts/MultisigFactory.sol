// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MultisigWallet.sol";

/**
 * @title MultisigFactory
 * @notice Factory contract for deploying new MultisigWallet instances.
 *         Tracks all deployed wallets and provides a registry for discovery.
 */
contract MultisigFactory {
    // ========================================================================
    // State
    // ========================================================================

    /// @notice All deployed multisig wallets
    address[] public wallets;

    /// @notice Wallets created by a specific address
    mapping(address => address[]) public walletsByCreator;

    /// @notice Wallets where an address is a signer
    mapping(address => address[]) public walletsBySigner;

    /// @notice Default proposal TTL (7 days)
    uint256 public constant DEFAULT_PROPOSAL_TTL = 7 days;

    // ========================================================================
    // Events
    // ========================================================================

    event WalletDeployed(
        address indexed wallet,
        address indexed creator,
        string name,
        address[] signers,
        uint256 threshold
    );

    // ========================================================================
    // Functions
    // ========================================================================

    /// @notice Deploy a new MultisigWallet
    /// @param _name Human-readable wallet name
    /// @param _signers Array of initial signer addresses
    /// @param _threshold Number of approvals required
    /// @param _proposalTTL Seconds until proposals expire (0 = use default 7 days)
    /// @return wallet The address of the newly deployed MultisigWallet
    function createWallet(
        string calldata _name,
        address[] calldata _signers,
        uint256 _threshold,
        uint256 _proposalTTL
    ) external returns (address wallet) {
        uint256 ttl = _proposalTTL > 0 ? _proposalTTL : DEFAULT_PROPOSAL_TTL;

        MultisigWallet msw = new MultisigWallet(_name, _signers, _threshold, ttl);
        wallet = address(msw);

        wallets.push(wallet);
        walletsByCreator[msg.sender].push(wallet);

        for (uint256 i = 0; i < _signers.length; i++) {
            walletsBySigner[_signers[i]].push(wallet);
        }

        emit WalletDeployed(wallet, msg.sender, _name, _signers, _threshold);
    }

    /// @notice Get total number of deployed wallets
    function getWalletCount() external view returns (uint256) {
        return wallets.length;
    }

    /// @notice Get all wallets deployed by a creator
    function getWalletsByCreator(address _creator) external view returns (address[] memory) {
        return walletsByCreator[_creator];
    }

    /// @notice Get all wallets where an address is a signer
    function getWalletsBySigner(address _signer) external view returns (address[] memory) {
        return walletsBySigner[_signer];
    }

    /// @notice Get all deployed wallet addresses
    function getAllWallets() external view returns (address[] memory) {
        return wallets;
    }
}
