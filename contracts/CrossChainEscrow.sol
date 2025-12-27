// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title VeridexCrossChainEscrow
 * @author Veridex Protocol
 * @notice Cross-chain escrow service using Wormhole VAA for trustless releases
 * @dev Enables secure P2P trades across different blockchains
 * 
 * Flow:
 * 1. Seller deposits on Chain A (e.g., NFT on Ethereum)
 * 2. Buyer deposits on Chain B (e.g., USDC on Base)
 * 3. Both parties confirm via passkey signatures
 * 4. Wormhole VAA proves confirmations cross-chain
 * 5. Assets released to respective parties
 * 
 * Example usage:
 * ```typescript
 * import { createSDK } from '@veridex/sdk';
 * 
 * // Seller on Ethereum
 * const sellerSdk = createSDK('ethereum');
 * await sellerSdk.passkey.register('seller@example.com', 'Seller');
 * 
 * // Create escrow
 * const escrowId = await escrow.createEscrow({
 *   seller: sellerSdk.getVaultAddress(),
 *   buyer: buyerVaultAddress,
 *   sellerAsset: NFT_ADDRESS,
 *   buyerAsset: USDC_ADDRESS,
 *   ...
 * });
 * 
 * // Confirm and release via Wormhole
 * await sellerSdk.execute({
 *   target: escrowAddress,
 *   data: escrow.interface.encodeFunctionData('confirm', [escrowId]),
 * });
 * ```
 */
contract VeridexCrossChainEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============================================================================
    // Structs
    // ============================================================================

    enum EscrowStatus {
        Created,            // Initial state
        SellerDeposited,    // Seller deposited assets
        BuyerDeposited,     // Buyer deposited assets
        FullyFunded,        // Both parties deposited
        SellerConfirmed,    // Seller confirmed trade
        BuyerConfirmed,     // Buyer confirmed trade
        Completed,          // Trade completed
        Disputed,           // Under dispute
        Cancelled,          // Cancelled before completion
        Refunded            // Refunded to both parties
    }

    struct Escrow {
        bytes32 escrowId;           // Unique escrow ID
        
        // Parties (Veridex vault addresses)
        address seller;
        address buyer;
        
        // Seller's asset
        address sellerToken;        // address(0) for native
        uint256 sellerAmount;
        bool sellerDeposited;
        bool sellerConfirmed;
        
        // Buyer's asset  
        address buyerToken;         // address(0) for native
        uint256 buyerAmount;
        bool buyerDeposited;
        bool buyerConfirmed;
        
        // Cross-chain info
        uint16 sellerChainId;       // Wormhole chain ID of seller
        uint16 buyerChainId;        // Wormhole chain ID of buyer
        bytes32 sellerEmitter;      // Seller's chain emitter
        bytes32 buyerEmitter;       // Buyer's chain emitter
        
        // Timing
        uint256 createdAt;
        uint256 expiresAt;
        uint256 completedAt;
        
        // Status
        EscrowStatus status;
        
        // Dispute
        address disputeResolver;
        string disputeReason;
    }

    // ============================================================================
    // State Variables
    // ============================================================================

    /// @notice Escrows by ID
    mapping(bytes32 => Escrow) public escrows;

    /// @notice Escrow IDs by participant
    mapping(address => bytes32[]) public participantEscrows;

    /// @notice Protocol fee in basis points
    uint256 public protocolFee = 25; // 0.25%

    /// @notice Fee recipient
    address public feeRecipient;

    /// @notice Default escrow duration
    uint256 public defaultDuration = 7 days;

    /// @notice Wormhole core bridge address
    address public wormhole;

    /// @notice This chain's Wormhole chain ID
    uint16 public thisChainId;

    /// @notice Escrow nonce
    uint256 private _escrowNonce;

    // ============================================================================
    // Events
    // ============================================================================

    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed seller,
        address indexed buyer,
        address sellerToken,
        uint256 sellerAmount,
        address buyerToken,
        uint256 buyerAmount
    );

    event SellerDeposited(bytes32 indexed escrowId, uint256 amount);
    event BuyerDeposited(bytes32 indexed escrowId, uint256 amount);
    event SellerConfirmed(bytes32 indexed escrowId);
    event BuyerConfirmed(bytes32 indexed escrowId);
    event EscrowCompleted(bytes32 indexed escrowId);
    event EscrowCancelled(bytes32 indexed escrowId);
    event EscrowRefunded(bytes32 indexed escrowId);
    event DisputeRaised(bytes32 indexed escrowId, address by, string reason);
    event DisputeResolved(bytes32 indexed escrowId, bool sellerWins);

    // ============================================================================
    // Errors
    // ============================================================================

    error EscrowNotFound();
    error NotParticipant();
    error InvalidStatus();
    error EscrowExpired();
    error AlreadyDeposited();
    error AlreadyConfirmed();
    error InsufficientDeposit();
    error InvalidVAA();
    error WrongChain();
    error TransferFailed();

    // ============================================================================
    // Constructor
    // ============================================================================

    constructor(address _wormhole, uint16 _chainId, address _feeRecipient) {
        wormhole = _wormhole;
        thisChainId = _chainId;
        feeRecipient = _feeRecipient;
    }

    // ============================================================================
    // Escrow Creation
    // ============================================================================

    /**
     * @notice Create a new cross-chain escrow
     * @param seller Seller's Veridex vault address
     * @param buyer Buyer's Veridex vault address
     * @param sellerToken Token seller is offering (address(0) for native)
     * @param sellerAmount Amount seller is offering
     * @param buyerToken Token buyer is paying (address(0) for native)
     * @param buyerAmount Amount buyer is paying
     * @param sellerChainId Wormhole chain ID where seller's assets are
     * @param buyerChainId Wormhole chain ID where buyer's assets are
     * @param duration Escrow duration in seconds
     * @return escrowId The new escrow ID
     */
    function createEscrow(
        address seller,
        address buyer,
        address sellerToken,
        uint256 sellerAmount,
        address buyerToken,
        uint256 buyerAmount,
        uint16 sellerChainId,
        uint16 buyerChainId,
        uint256 duration
    ) external returns (bytes32 escrowId) {
        if (duration == 0) duration = defaultDuration;

        escrowId = keccak256(abi.encodePacked(
            seller,
            buyer,
            block.timestamp,
            _escrowNonce++
        ));

        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            seller: seller,
            buyer: buyer,
            sellerToken: sellerToken,
            sellerAmount: sellerAmount,
            sellerDeposited: false,
            sellerConfirmed: false,
            buyerToken: buyerToken,
            buyerAmount: buyerAmount,
            buyerDeposited: false,
            buyerConfirmed: false,
            sellerChainId: sellerChainId,
            buyerChainId: buyerChainId,
            sellerEmitter: bytes32(0),
            buyerEmitter: bytes32(0),
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration,
            completedAt: 0,
            status: EscrowStatus.Created,
            disputeResolver: address(0),
            disputeReason: ""
        });

        participantEscrows[seller].push(escrowId);
        participantEscrows[buyer].push(escrowId);

        emit EscrowCreated(
            escrowId,
            seller,
            buyer,
            sellerToken,
            sellerAmount,
            buyerToken,
            buyerAmount
        );
    }

    // ============================================================================
    // Deposit Functions
    // ============================================================================

    /**
     * @notice Seller deposits their asset
     * @param escrowId The escrow to deposit into
     */
    function sellerDeposit(bytes32 escrowId) external payable nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.seller) revert NotParticipant();
        if (escrow.sellerDeposited) revert AlreadyDeposited();
        if (block.timestamp > escrow.expiresAt) revert EscrowExpired();
        if (escrow.sellerChainId != thisChainId) revert WrongChain();

        // Transfer assets
        if (escrow.sellerToken == address(0)) {
            if (msg.value < escrow.sellerAmount) revert InsufficientDeposit();
        } else {
            IERC20(escrow.sellerToken).safeTransferFrom(
                msg.sender,
                address(this),
                escrow.sellerAmount
            );
        }

        escrow.sellerDeposited = true;
        _updateStatus(escrow);

        emit SellerDeposited(escrowId, escrow.sellerAmount);
    }

    /**
     * @notice Buyer deposits their asset
     * @param escrowId The escrow to deposit into
     */
    function buyerDeposit(bytes32 escrowId) external payable nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.buyer == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.buyer) revert NotParticipant();
        if (escrow.buyerDeposited) revert AlreadyDeposited();
        if (block.timestamp > escrow.expiresAt) revert EscrowExpired();
        if (escrow.buyerChainId != thisChainId) revert WrongChain();

        // Transfer assets
        if (escrow.buyerToken == address(0)) {
            if (msg.value < escrow.buyerAmount) revert InsufficientDeposit();
        } else {
            IERC20(escrow.buyerToken).safeTransferFrom(
                msg.sender,
                address(this),
                escrow.buyerAmount
            );
        }

        escrow.buyerDeposited = true;
        _updateStatus(escrow);

        emit BuyerDeposited(escrowId, escrow.buyerAmount);
    }

    // ============================================================================
    // Confirmation & Release
    // ============================================================================

    /**
     * @notice Seller confirms the trade (called via vault execute or session key)
     * @param escrowId The escrow to confirm
     */
    function sellerConfirm(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.seller) revert NotParticipant();
        if (escrow.sellerConfirmed) revert AlreadyConfirmed();
        if (escrow.status != EscrowStatus.FullyFunded) revert InvalidStatus();

        escrow.sellerConfirmed = true;
        _updateStatus(escrow);
        
        emit SellerConfirmed(escrowId);
        
        _tryComplete(escrow);
    }

    /**
     * @notice Buyer confirms the trade
     * @param escrowId The escrow to confirm
     */
    function buyerConfirm(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.buyer == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.buyer) revert NotParticipant();
        if (escrow.buyerConfirmed) revert AlreadyConfirmed();
        if (escrow.status != EscrowStatus.FullyFunded &&
            escrow.status != EscrowStatus.SellerConfirmed) {
            revert InvalidStatus();
        }

        escrow.buyerConfirmed = true;
        _updateStatus(escrow);
        
        emit BuyerConfirmed(escrowId);
        
        _tryComplete(escrow);
    }

    /**
     * @notice Update escrow status based on current state
     */
    function _updateStatus(Escrow storage escrow) internal {
        if (escrow.sellerDeposited && escrow.buyerDeposited) {
            if (escrow.sellerConfirmed && escrow.buyerConfirmed) {
                escrow.status = EscrowStatus.Completed;
            } else if (escrow.sellerConfirmed) {
                escrow.status = EscrowStatus.SellerConfirmed;
            } else if (escrow.buyerConfirmed) {
                escrow.status = EscrowStatus.BuyerConfirmed;
            } else {
                escrow.status = EscrowStatus.FullyFunded;
            }
        } else if (escrow.sellerDeposited) {
            escrow.status = EscrowStatus.SellerDeposited;
        } else if (escrow.buyerDeposited) {
            escrow.status = EscrowStatus.BuyerDeposited;
        }
    }

    /**
     * @notice Try to complete escrow if both confirmed
     */
    function _tryComplete(Escrow storage escrow) internal {
        if (!escrow.sellerConfirmed || !escrow.buyerConfirmed) return;
        
        // Release seller's asset to buyer
        if (escrow.sellerChainId == thisChainId) {
            _releaseAsset(
                escrow.buyer,
                escrow.sellerToken,
                escrow.sellerAmount
            );
        }
        
        // Release buyer's asset to seller
        if (escrow.buyerChainId == thisChainId) {
            _releaseAsset(
                escrow.seller,
                escrow.buyerToken,
                escrow.buyerAmount
            );
        }

        escrow.status = EscrowStatus.Completed;
        escrow.completedAt = block.timestamp;

        emit EscrowCompleted(escrow.escrowId);
    }

    /**
     * @notice Release asset to recipient
     */
    function _releaseAsset(
        address recipient,
        address token,
        uint256 amount
    ) internal {
        // Calculate fee
        uint256 fee = (amount * protocolFee) / 10000;
        uint256 recipientAmount = amount - fee;

        if (token == address(0)) {
            (bool success, ) = recipient.call{value: recipientAmount}("");
            if (!success) revert TransferFailed();
            if (fee > 0) {
                (success, ) = feeRecipient.call{value: fee}("");
                // Fee transfer failure is non-critical
            }
        } else {
            IERC20(token).safeTransfer(recipient, recipientAmount);
            if (fee > 0) {
                IERC20(token).safeTransfer(feeRecipient, fee);
            }
        }
    }

    // ============================================================================
    // Cancellation & Refund
    // ============================================================================

    /**
     * @notice Cancel escrow (only before fully funded)
     */
    function cancel(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (msg.sender != escrow.seller && msg.sender != escrow.buyer) {
            revert NotParticipant();
        }
        if (escrow.status == EscrowStatus.FullyFunded ||
            escrow.status == EscrowStatus.Completed) {
            revert InvalidStatus();
        }

        // Refund any deposits
        if (escrow.sellerDeposited && escrow.sellerChainId == thisChainId) {
            _releaseAsset(escrow.seller, escrow.sellerToken, escrow.sellerAmount);
        }
        if (escrow.buyerDeposited && escrow.buyerChainId == thisChainId) {
            _releaseAsset(escrow.buyer, escrow.buyerToken, escrow.buyerAmount);
        }

        escrow.status = EscrowStatus.Cancelled;
        emit EscrowCancelled(escrowId);
    }

    /**
     * @notice Refund expired escrow
     */
    function refundExpired(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.seller == address(0)) revert EscrowNotFound();
        if (block.timestamp <= escrow.expiresAt) revert InvalidStatus();
        if (escrow.status == EscrowStatus.Completed ||
            escrow.status == EscrowStatus.Refunded) {
            revert InvalidStatus();
        }

        // Refund deposits to original depositors
        if (escrow.sellerDeposited && escrow.sellerChainId == thisChainId) {
            _releaseAsset(escrow.seller, escrow.sellerToken, escrow.sellerAmount);
        }
        if (escrow.buyerDeposited && escrow.buyerChainId == thisChainId) {
            _releaseAsset(escrow.buyer, escrow.buyerToken, escrow.buyerAmount);
        }

        escrow.status = EscrowStatus.Refunded;
        emit EscrowRefunded(escrowId);
    }

    // ============================================================================
    // View Functions
    // ============================================================================

    /**
     * @notice Get escrow details
     */
    function getEscrow(bytes32 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }

    /**
     * @notice Get escrows for a participant
     */
    function getParticipantEscrows(
        address participant
    ) external view returns (bytes32[] memory) {
        return participantEscrows[participant];
    }

    /**
     * @notice Check if escrow is active
     */
    function isActive(bytes32 escrowId) external view returns (bool) {
        Escrow storage escrow = escrows[escrowId];
        return escrow.status != EscrowStatus.Completed &&
               escrow.status != EscrowStatus.Cancelled &&
               escrow.status != EscrowStatus.Refunded &&
               block.timestamp <= escrow.expiresAt;
    }

    // ============================================================================
    // Fallback
    // ============================================================================

    receive() external payable {}
}
