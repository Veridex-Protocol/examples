// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VeridexPaymentGateway
 * @author Veridex Protocol
 * @notice Accept payments to Veridex vaults with invoice tracking
 * @dev Integrates with Veridex SDK for passkey-authenticated payments
 * 
 * Example usage:
 * ```typescript
 * import { createSDK } from '@veridex/sdk';
 * 
 * const sdk = createSDK('base');
 * await sdk.passkey.register('merchant@shop.com', 'My Shop');
 * 
 * // Create invoice
 * const invoiceId = await gateway.createInvoice(
 *   sdk.getVaultAddress(), // Merchant vault receives payment
 *   parseUnits('100', 6),  // $100 USDC
 *   'ORDER-12345'
 * );
 * 
 * // Customer pays directly to invoice
 * await gateway.payInvoice(invoiceId, { value: amount });
 * ```
 */
contract VeridexPaymentGateway is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============================================================================
    // Structs
    // ============================================================================

    struct Invoice {
        bytes32 id;                 // Unique invoice identifier
        address merchant;           // Merchant vault address (Veridex vault)
        address token;              // Payment token (address(0) for native)
        uint256 amount;             // Payment amount
        uint256 paidAmount;         // Amount paid so far
        uint256 createdAt;          // Creation timestamp
        uint256 expiresAt;          // Expiration timestamp (0 = never)
        string reference;           // External reference (order ID, etc.)
        InvoiceStatus status;       // Current status
        address payer;              // Who paid (if paid)
        uint256 paidAt;             // When paid
    }

    enum InvoiceStatus {
        Pending,
        Paid,
        PartiallyPaid,
        Expired,
        Cancelled,
        Refunded
    }

    struct Merchant {
        address vault;              // Veridex vault address
        string name;                // Business name
        uint256 totalReceived;      // Total payments received
        uint256 invoiceCount;       // Number of invoices created
        bool isActive;              // Whether merchant is active
        uint256 feeOverride;        // Custom fee (0 = use default)
    }

    // ============================================================================
    // State Variables
    // ============================================================================

    /// @notice Protocol fee in basis points (100 = 1%)
    uint256 public protocolFee = 50; // 0.5% default

    /// @notice Maximum fee allowed (5%)
    uint256 public constant MAX_FEE = 500;

    /// @notice Fee recipient
    address public feeRecipient;

    /// @notice Invoice storage
    mapping(bytes32 => Invoice) public invoices;

    /// @notice Merchant registry
    mapping(address => Merchant) public merchants;

    /// @notice Invoice IDs by merchant
    mapping(address => bytes32[]) public merchantInvoices;

    /// @notice Supported payment tokens
    mapping(address => bool) public supportedTokens;

    /// @notice Invoice nonce for unique ID generation
    uint256 private _invoiceNonce;

    // ============================================================================
    // Events
    // ============================================================================

    event MerchantRegistered(
        address indexed vault,
        string name
    );

    event InvoiceCreated(
        bytes32 indexed invoiceId,
        address indexed merchant,
        address token,
        uint256 amount,
        string reference
    );

    event InvoicePaid(
        bytes32 indexed invoiceId,
        address indexed payer,
        uint256 amount,
        uint256 fee
    );

    event InvoiceCancelled(bytes32 indexed invoiceId);
    event InvoiceRefunded(bytes32 indexed invoiceId, uint256 amount);
    event TokenSupported(address indexed token, bool supported);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    // ============================================================================
    // Errors
    // ============================================================================

    error InvoiceNotFound();
    error InvoiceNotPending();
    error InvoiceExpired();
    error InsufficientPayment();
    error InvalidAmount();
    error InvalidToken();
    error MerchantNotRegistered();
    error NotMerchant();
    error AlreadyRegistered();
    error FeeTooHigh();
    error TransferFailed();

    // ============================================================================
    // Constructor
    // ============================================================================

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        
        // Native token always supported
        supportedTokens[address(0)] = true;
    }

    // ============================================================================
    // Merchant Functions
    // ============================================================================

    /**
     * @notice Register as a merchant with a Veridex vault
     * @param vault The Veridex vault address that will receive payments
     * @param name Business name for display
     * 
     * @dev The vault address should be computed from the merchant's passkey:
     * ```typescript
     * const sdk = createSDK('base');
     * await sdk.passkey.register('merchant@example.com', 'My Store');
     * const vaultAddress = sdk.getVaultAddress();
     * await gateway.registerMerchant(vaultAddress, 'My Store');
     * ```
     */
    function registerMerchant(address vault, string calldata name) external {
        if (merchants[vault].isActive) revert AlreadyRegistered();
        
        merchants[vault] = Merchant({
            vault: vault,
            name: name,
            totalReceived: 0,
            invoiceCount: 0,
            isActive: true,
            feeOverride: 0
        });

        emit MerchantRegistered(vault, name);
    }

    /**
     * @notice Create a new invoice for payment
     * @param token Payment token (address(0) for native ETH/MATIC/etc)
     * @param amount Amount to charge
     * @param reference External reference (order ID, subscription ID, etc)
     * @param expiresIn Seconds until expiration (0 = never)
     * @return invoiceId The unique invoice identifier
     */
    function createInvoice(
        address token,
        uint256 amount,
        string calldata reference,
        uint256 expiresIn
    ) external returns (bytes32 invoiceId) {
        if (!merchants[msg.sender].isActive) revert MerchantNotRegistered();
        if (amount == 0) revert InvalidAmount();
        if (!supportedTokens[token]) revert InvalidToken();

        // Generate unique invoice ID
        invoiceId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            _invoiceNonce++
        ));

        uint256 expiresAt = expiresIn > 0 ? block.timestamp + expiresIn : 0;

        invoices[invoiceId] = Invoice({
            id: invoiceId,
            merchant: msg.sender,
            token: token,
            amount: amount,
            paidAmount: 0,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            reference: reference,
            status: InvoiceStatus.Pending,
            payer: address(0),
            paidAt: 0
        });

        merchantInvoices[msg.sender].push(invoiceId);
        merchants[msg.sender].invoiceCount++;

        emit InvoiceCreated(invoiceId, msg.sender, token, amount, reference);
    }

    // ============================================================================
    // Payment Functions
    // ============================================================================

    /**
     * @notice Pay an invoice with native token
     * @param invoiceId The invoice to pay
     */
    function payInvoice(bytes32 invoiceId) external payable nonReentrant {
        Invoice storage invoice = invoices[invoiceId];
        
        if (invoice.merchant == address(0)) revert InvoiceNotFound();
        if (invoice.status != InvoiceStatus.Pending) revert InvoiceNotPending();
        if (invoice.expiresAt != 0 && block.timestamp > invoice.expiresAt) {
            invoice.status = InvoiceStatus.Expired;
            revert InvoiceExpired();
        }
        if (invoice.token != address(0)) revert InvalidToken();
        if (msg.value < invoice.amount) revert InsufficientPayment();

        _processPayment(invoice, msg.value);
    }

    /**
     * @notice Pay an invoice with ERC20 token
     * @param invoiceId The invoice to pay
     * @param amount Amount to pay
     */
    function payInvoiceWithToken(
        bytes32 invoiceId, 
        uint256 amount
    ) external nonReentrant {
        Invoice storage invoice = invoices[invoiceId];
        
        if (invoice.merchant == address(0)) revert InvoiceNotFound();
        if (invoice.status != InvoiceStatus.Pending) revert InvoiceNotPending();
        if (invoice.expiresAt != 0 && block.timestamp > invoice.expiresAt) {
            invoice.status = InvoiceStatus.Expired;
            revert InvoiceExpired();
        }
        if (invoice.token == address(0)) revert InvalidToken();
        if (amount < invoice.amount) revert InsufficientPayment();

        // Transfer tokens from payer
        IERC20(invoice.token).safeTransferFrom(msg.sender, address(this), amount);
        
        _processPayment(invoice, amount);
    }

    /**
     * @notice Internal payment processing
     */
    function _processPayment(Invoice storage invoice, uint256 amount) internal {
        // Calculate fee
        uint256 fee = _calculateFee(invoice.merchant, amount);
        uint256 merchantAmount = amount - fee;

        // Update invoice
        invoice.paidAmount = amount;
        invoice.status = InvoiceStatus.Paid;
        invoice.payer = msg.sender;
        invoice.paidAt = block.timestamp;

        // Update merchant stats
        merchants[invoice.merchant].totalReceived += merchantAmount;

        // Transfer to merchant vault
        if (invoice.token == address(0)) {
            // Native token
            (bool success, ) = invoice.merchant.call{value: merchantAmount}("");
            if (!success) revert TransferFailed();
            
            // Transfer fee
            if (fee > 0) {
                (success, ) = feeRecipient.call{value: fee}("");
                if (!success) revert TransferFailed();
            }
        } else {
            // ERC20 token
            IERC20(invoice.token).safeTransfer(invoice.merchant, merchantAmount);
            if (fee > 0) {
                IERC20(invoice.token).safeTransfer(feeRecipient, fee);
            }
        }

        emit InvoicePaid(invoice.id, msg.sender, amount, fee);
    }

    /**
     * @notice Calculate fee for a payment
     */
    function _calculateFee(
        address merchant, 
        uint256 amount
    ) internal view returns (uint256) {
        uint256 fee = merchants[merchant].feeOverride;
        if (fee == 0) fee = protocolFee;
        return (amount * fee) / 10000;
    }

    // ============================================================================
    // Invoice Management
    // ============================================================================

    /**
     * @notice Cancel a pending invoice (merchant only)
     */
    function cancelInvoice(bytes32 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        if (invoice.merchant != msg.sender) revert NotMerchant();
        if (invoice.status != InvoiceStatus.Pending) revert InvoiceNotPending();

        invoice.status = InvoiceStatus.Cancelled;
        emit InvoiceCancelled(invoiceId);
    }

    /**
     * @notice Get invoice details
     */
    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory) {
        return invoices[invoiceId];
    }

    /**
     * @notice Get all invoices for a merchant
     */
    function getMerchantInvoices(
        address merchant
    ) external view returns (bytes32[] memory) {
        return merchantInvoices[merchant];
    }

    // ============================================================================
    // Admin Functions
    // ============================================================================

    /**
     * @notice Add or remove supported payment token
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    /**
     * @notice Update protocol fee
     */
    function setProtocolFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_FEE) revert FeeTooHigh();
        uint256 oldFee = protocolFee;
        protocolFee = newFee;
        emit FeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    /**
     * @notice Set custom fee for a merchant
     */
    function setMerchantFee(address merchant, uint256 fee) external onlyOwner {
        if (fee > MAX_FEE) revert FeeTooHigh();
        merchants[merchant].feeOverride = fee;
    }

    // ============================================================================
    // Fallback
    // ============================================================================

    receive() external payable {}
}
