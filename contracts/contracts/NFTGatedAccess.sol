// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VeridexNFTGatedAccess
 * @author Veridex Protocol
 * @notice Control access to content/features based on NFT ownership in Veridex vaults
 * @dev Perfect for gating premium content, memberships, or exclusive features
 * 
 * Example usage:
 * ```typescript
 * import { createSDK } from 'veridex/sdk';
 * 
 * const sdk = createSDK('base');
 * await sdk.passkey.register("user-example.com", "My Wallet");
 * const vaultAddress = sdk.getVaultAddress();
 * 
 * // Check if user has access
 * const hasAccess = await accessControl.hasAccess(vaultAddress, 'premium-content');
 * 
 * // Verify with signature for trustless access
 * const signature = await sdk.passkey.sign(challenge);
 * const verified = await accessControl.verifyAccessWithSignature(
 *   vaultAddress, 
 *   'premium-content',
 *   signature
 * );
 * ```
 */
contract VeridexNFTGatedAccess is ReentrancyGuard, AccessControl {
    
    // ============================================================================
    // Roles
    // ============================================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============================================================================
    // Structs
    // ============================================================================

    enum TokenType {
        ERC721,
        ERC1155
    }

    struct AccessRule {
        string ruleId;              // Unique rule identifier
        address tokenContract;       // NFT contract address
        TokenType tokenType;         // ERC721 or ERC1155
        uint256 tokenId;            // Token ID (for ERC1155, 0 for any ERC721)
        uint256 minBalance;         // Minimum balance required
        bool isActive;              // Whether rule is active
        uint256 createdAt;          // Creation timestamp
    }

    struct AccessGrant {
        address vault;              // Veridex vault address
        string ruleId;              // Rule ID granted access
        uint256 grantedAt;          // When access was granted
        uint256 expiresAt;          // Expiration (0 = never)
        bool isActive;              // Whether grant is active
    }

    // ============================================================================
    // State Variables
    // ============================================================================

    /// @notice Access rules by rule ID
    mapping(string => AccessRule) public accessRules;

    /// @notice All rule IDs
    string[] public ruleIds;

    /// @notice Manual access grants (vault => ruleId => grant)
    mapping(address => mapping(string => AccessGrant)) public accessGrants;

    /// @notice Access log for analytics
    mapping(address => uint256) public lastAccessTime;

    // ============================================================================
    // Events
    // ============================================================================

    event AccessRuleCreated(
        string indexed ruleId,
        address tokenContract,
        TokenType tokenType,
        uint256 minBalance
    );

    event AccessRuleUpdated(string indexed ruleId, bool isActive);

    event AccessGranted(
        address indexed vault,
        string indexed ruleId,
        uint256 expiresAt
    );

    event AccessRevoked(address indexed vault, string indexed ruleId);

    event AccessChecked(
        address indexed vault,
        string indexed ruleId,
        bool hasAccess
    );

    // ============================================================================
    // Errors
    // ============================================================================

    error RuleNotFound();
    error RuleAlreadyExists();
    error RuleNotActive();
    error InvalidTokenContract();
    error InvalidMinBalance();
    error AccessDenied();
    error GrantNotFound();
    error GrantExpired();

    // ============================================================================
    // Constructor
    // ============================================================================

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ============================================================================
    // Rule Management
    // ============================================================================

    /**
     * @notice Create a new access rule based on NFT ownership
     * @param ruleId Unique identifier for this rule
     * @param tokenContract NFT contract address
     * @param tokenType ERC721 or ERC1155
     * @param tokenId Token ID (0 for any token in ERC721)
     * @param minBalance Minimum tokens required (usually 1)
     */
    function createAccessRule(
        string calldata ruleId,
        address tokenContract,
        TokenType tokenType,
        uint256 tokenId,
        uint256 minBalance
    ) external onlyRole(ADMIN_ROLE) {
        if (accessRules[ruleId].tokenContract != address(0)) {
            revert RuleAlreadyExists();
        }
        if (tokenContract == address(0)) revert InvalidTokenContract();
        if (minBalance == 0) revert InvalidMinBalance();

        accessRules[ruleId] = AccessRule({
            ruleId: ruleId,
            tokenContract: tokenContract,
            tokenType: tokenType,
            tokenId: tokenId,
            minBalance: minBalance,
            isActive: true,
            createdAt: block.timestamp
        });

        ruleIds.push(ruleId);

        emit AccessRuleCreated(ruleId, tokenContract, tokenType, minBalance);
    }

    /**
     * @notice Update rule active status
     */
    function setRuleActive(
        string calldata ruleId, 
        bool isActive
    ) external onlyRole(ADMIN_ROLE) {
        if (accessRules[ruleId].tokenContract == address(0)) {
            revert RuleNotFound();
        }
        accessRules[ruleId].isActive = isActive;
        emit AccessRuleUpdated(ruleId, isActive);
    }

    // ============================================================================
    // Access Checking
    // ============================================================================

    /**
     * @notice Check if a Veridex vault has access based on NFT ownership
     * @param vault The Veridex vault address to check
     * @param ruleId The access rule to check against
     * @return hasAccess Whether the vault has access
     * 
     * @dev This checks NFT balance directly in the vault. The vault address
     * is derived from the user's passkey and is the same on all EVM chains.
     */
    function checkAccess(
        address vault,
        string calldata ruleId
    ) public view returns (bool hasAccess) {
        AccessRule storage rule = accessRules[ruleId];
        
        if (rule.tokenContract == address(0)) revert RuleNotFound();
        if (!rule.isActive) return false;

        // Check for manual grant first
        AccessGrant storage grant = accessGrants[vault][ruleId];
        if (grant.isActive) {
            if (grant.expiresAt == 0 || block.timestamp <= grant.expiresAt) {
                return true;
            }
        }

        // Check NFT ownership
        if (rule.tokenType == TokenType.ERC721) {
            uint256 balance = IERC721(rule.tokenContract).balanceOf(vault);
            return balance >= rule.minBalance;
        } else {
            uint256 balance = IERC1155(rule.tokenContract).balanceOf(
                vault, 
                rule.tokenId
            );
            return balance >= rule.minBalance;
        }
    }

    /**
     * @notice Check access and emit event (for off-chain tracking)
     */
    function checkAccessWithEvent(
        address vault,
        string calldata ruleId
    ) external returns (bool hasAccess) {
        hasAccess = checkAccess(vault, ruleId);
        lastAccessTime[vault] = block.timestamp;
        emit AccessChecked(vault, ruleId, hasAccess);
    }

    /**
     * @notice Require access or revert
     */
    function requireAccess(
        address vault,
        string calldata ruleId
    ) external view {
        if (!checkAccess(vault, ruleId)) {
            revert AccessDenied();
        }
    }

    /**
     * @notice Check multiple rules at once
     * @param vault The vault to check
     * @param ruleIdsToCheck Array of rule IDs
     * @return results Access result for each rule
     */
    function checkMultipleAccess(
        address vault,
        string[] calldata ruleIdsToCheck
    ) external view returns (bool[] memory results) {
        results = new bool[](ruleIdsToCheck.length);
        for (uint256 i = 0; i < ruleIdsToCheck.length; i++) {
            results[i] = checkAccess(vault, ruleIdsToCheck[i]);
        }
    }

    // ============================================================================
    // Manual Access Grants
    // ============================================================================

    /**
     * @notice Manually grant access to a vault (for promotions, etc)
     * @param vault The Veridex vault address
     * @param ruleId The rule to grant access to
     * @param duration Duration in seconds (0 = permanent)
     */
    function grantAccess(
        address vault,
        string calldata ruleId,
        uint256 duration
    ) external onlyRole(OPERATOR_ROLE) {
        if (accessRules[ruleId].tokenContract == address(0)) {
            revert RuleNotFound();
        }

        uint256 expiresAt = duration > 0 ? block.timestamp + duration : 0;

        accessGrants[vault][ruleId] = AccessGrant({
            vault: vault,
            ruleId: ruleId,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true
        });

        emit AccessGranted(vault, ruleId, expiresAt);
    }

    /**
     * @notice Revoke manual access grant
     */
    function revokeAccess(
        address vault,
        string calldata ruleId
    ) external onlyRole(OPERATOR_ROLE) {
        AccessGrant storage grant = accessGrants[vault][ruleId];
        if (!grant.isActive) revert GrantNotFound();

        grant.isActive = false;
        emit AccessRevoked(vault, ruleId);
    }

    // ============================================================================
    // View Functions
    // ============================================================================

    /**
     * @notice Get all access rules
     */
    function getAllRules() external view returns (AccessRule[] memory) {
        AccessRule[] memory rules = new AccessRule[](ruleIds.length);
        for (uint256 i = 0; i < ruleIds.length; i++) {
            rules[i] = accessRules[ruleIds[i]];
        }
        return rules;
    }

    /**
     * @notice Get rule count
     */
    function getRuleCount() external view returns (uint256) {
        return ruleIds.length;
    }

    /**
     * @notice Get access grant details
     */
    function getAccessGrant(
        address vault,
        string calldata ruleId
    ) external view returns (AccessGrant memory) {
        return accessGrants[vault][ruleId];
    }
}
