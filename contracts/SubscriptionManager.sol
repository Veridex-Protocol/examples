// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VeridexSubscriptionManager
 * @author Veridex Protocol
 * @notice Manage recurring subscriptions with Veridex vault payments
 * @dev Supports pull-based payments from Veridex vaults using session keys
 * 
 * Architecture:
 * 1. User creates Veridex vault via passkey
 * 2. User creates a session key with spending limits
 * 3. User authorizes subscription with session key
 * 4. Service can pull payments using the session key authorization
 * 
 * Example usage:
 * ```typescript
 * import { createSDK } from '@veridex/sdk';
 * 
 * const sdk = createSDK('base');
 * const session = await sdk.sessions.create({
 *   duration: 30 * 24 * 3600, // 30 days
 *   maxValue: parseUnits('100', 6), // Max $100 per period
 * });
 * 
 * // Authorize subscription
 * await subscriptionManager.subscribe(
 *   'premium-monthly',
 *   session.sessionKey,
 *   { value: firstPayment }
 * );
 * ```
 */
contract VeridexSubscriptionManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============================================================================
    // Structs
    // ============================================================================

    struct Plan {
        bytes32 planId;             // Unique plan identifier
        string name;                // Plan name
        address token;              // Payment token (address(0) for native)
        uint256 price;              // Price per period
        uint256 period;             // Billing period in seconds
        uint256 trialPeriod;        // Free trial duration
        bool isActive;              // Whether plan is active
        address merchant;           // Merchant receiving payments
        uint256 subscriberCount;    // Active subscribers
    }

    struct Subscription {
        bytes32 subscriptionId;     // Unique subscription ID
        bytes32 planId;             // Plan subscribed to
        address subscriber;         // Veridex vault address
        uint256 startedAt;          // Subscription start time
        uint256 currentPeriodStart; // Current billing period start
        uint256 currentPeriodEnd;   // Current billing period end
        uint256 cancelledAt;        // When cancelled (0 if active)
        SubscriptionStatus status;  // Current status
        uint256 totalPaid;          // Total amount paid
        uint256 paymentCount;       // Number of payments made
    }

    enum SubscriptionStatus {
        Active,
        PastDue,
        Cancelled,
        Expired,
        Paused
    }

    // ============================================================================
    // State Variables
    // ============================================================================

    /// @notice Plans by ID
    mapping(bytes32 => Plan) public plans;

    /// @notice All plan IDs
    bytes32[] public planIds;

    /// @notice Subscriptions by ID
    mapping(bytes32 => Subscription) public subscriptions;

    /// @notice Subscription IDs by vault
    mapping(address => bytes32[]) public vaultSubscriptions;

    /// @notice Active subscription per vault per plan (only one allowed)
    mapping(address => mapping(bytes32 => bytes32)) public activeSubscription;

    /// @notice Grace period for past due subscriptions
    uint256 public gracePeriod = 3 days;

    /// @notice Subscription nonce for unique ID generation
    uint256 private _subscriptionNonce;

    // ============================================================================
    // Events
    // ============================================================================

    event PlanCreated(
        bytes32 indexed planId,
        string name,
        uint256 price,
        uint256 period
    );

    event PlanUpdated(bytes32 indexed planId, bool isActive);

    event Subscribed(
        bytes32 indexed subscriptionId,
        bytes32 indexed planId,
        address indexed subscriber
    );

    event PaymentProcessed(
        bytes32 indexed subscriptionId,
        uint256 amount,
        uint256 periodStart,
        uint256 periodEnd
    );

    event SubscriptionCancelled(bytes32 indexed subscriptionId);
    event SubscriptionPaused(bytes32 indexed subscriptionId);
    event SubscriptionResumed(bytes32 indexed subscriptionId);

    // ============================================================================
    // Errors
    // ============================================================================

    error PlanNotFound();
    error PlanNotActive();
    error PlanAlreadyExists();
    error SubscriptionNotFound();
    error SubscriptionNotActive();
    error AlreadySubscribed();
    error NotSubscriber();
    error PaymentFailed();
    error NotDueYet();
    error InvalidPeriod();
    error InvalidPrice();

    // ============================================================================
    // Constructor
    // ============================================================================

    constructor() Ownable(msg.sender) {}

    // ============================================================================
    // Plan Management
    // ============================================================================

    /**
     * @notice Create a new subscription plan
     * @param planId Unique plan identifier
     * @param name Human-readable plan name
     * @param token Payment token (address(0) for native)
     * @param price Price per period
     * @param period Billing period in seconds (e.g., 30 days = 2592000)
     * @param trialPeriod Free trial duration in seconds
     */
    function createPlan(
        bytes32 planId,
        string calldata name,
        address token,
        uint256 price,
        uint256 period,
        uint256 trialPeriod
    ) external {
        if (plans[planId].merchant != address(0)) revert PlanAlreadyExists();
        if (period == 0) revert InvalidPeriod();
        if (price == 0) revert InvalidPrice();

        plans[planId] = Plan({
            planId: planId,
            name: name,
            token: token,
            price: price,
            period: period,
            trialPeriod: trialPeriod,
            isActive: true,
            merchant: msg.sender,
            subscriberCount: 0
        });

        planIds.push(planId);

        emit PlanCreated(planId, name, price, period);
    }

    /**
     * @notice Update plan active status
     */
    function setPlanActive(bytes32 planId, bool isActive) external {
        Plan storage plan = plans[planId];
        if (plan.merchant == address(0)) revert PlanNotFound();
        if (plan.merchant != msg.sender) revert NotSubscriber();
        
        plan.isActive = isActive;
        emit PlanUpdated(planId, isActive);
    }

    // ============================================================================
    // Subscription Management
    // ============================================================================

    /**
     * @notice Subscribe to a plan (called by user's vault)
     * @param planId The plan to subscribe to
     * @return subscriptionId The new subscription ID
     * 
     * @dev For Veridex vaults, this is called via the vault's execute function
     * or through a session key authorization.
     */
    function subscribe(bytes32 planId) external payable nonReentrant returns (bytes32 subscriptionId) {
        Plan storage plan = plans[planId];
        
        if (plan.merchant == address(0)) revert PlanNotFound();
        if (!plan.isActive) revert PlanNotActive();
        if (activeSubscription[msg.sender][planId] != bytes32(0)) {
            revert AlreadySubscribed();
        }

        // Generate subscription ID
        subscriptionId = keccak256(abi.encodePacked(
            msg.sender,
            planId,
            block.timestamp,
            _subscriptionNonce++
        ));

        // Calculate first period (with trial if applicable)
        uint256 periodStart = block.timestamp;
        uint256 periodEnd = periodStart + plan.trialPeriod + plan.period;

        subscriptions[subscriptionId] = Subscription({
            subscriptionId: subscriptionId,
            planId: planId,
            subscriber: msg.sender,
            startedAt: block.timestamp,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelledAt: 0,
            status: SubscriptionStatus.Active,
            totalPaid: 0,
            paymentCount: 0
        });

        // Process first payment (skip if trial)
        if (plan.trialPeriod == 0) {
            _processPayment(subscriptionId);
        }

        vaultSubscriptions[msg.sender].push(subscriptionId);
        activeSubscription[msg.sender][planId] = subscriptionId;
        plan.subscriberCount++;

        emit Subscribed(subscriptionId, planId, msg.sender);
    }

    /**
     * @notice Process recurring payment (can be called by anyone)
     * @param subscriptionId The subscription to charge
     * 
     * @dev In production, this would integrate with Veridex session keys
     * to allow automatic payment pulls within authorized limits.
     */
    function processPayment(bytes32 subscriptionId) external nonReentrant {
        Subscription storage sub = subscriptions[subscriptionId];
        
        if (sub.subscriber == address(0)) revert SubscriptionNotFound();
        if (sub.status != SubscriptionStatus.Active && 
            sub.status != SubscriptionStatus.PastDue) {
            revert SubscriptionNotActive();
        }
        if (block.timestamp < sub.currentPeriodEnd) revert NotDueYet();

        _processPayment(subscriptionId);
    }

    /**
     * @notice Internal payment processing
     */
    function _processPayment(bytes32 subscriptionId) internal {
        Subscription storage sub = subscriptions[subscriptionId];
        Plan storage plan = plans[sub.planId];

        // Transfer payment
        if (plan.token == address(0)) {
            // Native token payment
            if (address(sub.subscriber).balance < plan.price) {
                sub.status = SubscriptionStatus.PastDue;
                return;
            }
            // Note: In production, this would use vault.execute() or session key
            // For demo, we expect payment to be sent with the call
            (bool success, ) = plan.merchant.call{value: plan.price}("");
            if (!success) revert PaymentFailed();
        } else {
            // ERC20 payment - requires approval
            IERC20 token = IERC20(plan.token);
            if (token.balanceOf(sub.subscriber) < plan.price) {
                sub.status = SubscriptionStatus.PastDue;
                return;
            }
            if (token.allowance(sub.subscriber, address(this)) < plan.price) {
                sub.status = SubscriptionStatus.PastDue;
                return;
            }
            token.safeTransferFrom(sub.subscriber, plan.merchant, plan.price);
        }

        // Update subscription period
        sub.currentPeriodStart = block.timestamp;
        sub.currentPeriodEnd = block.timestamp + plan.period;
        sub.totalPaid += plan.price;
        sub.paymentCount++;
        sub.status = SubscriptionStatus.Active;

        emit PaymentProcessed(
            subscriptionId, 
            plan.price, 
            sub.currentPeriodStart, 
            sub.currentPeriodEnd
        );
    }

    /**
     * @notice Cancel subscription
     */
    function cancel(bytes32 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        
        if (sub.subscriber == address(0)) revert SubscriptionNotFound();
        if (sub.subscriber != msg.sender && plans[sub.planId].merchant != msg.sender) {
            revert NotSubscriber();
        }
        if (sub.status == SubscriptionStatus.Cancelled) {
            revert SubscriptionNotActive();
        }

        sub.status = SubscriptionStatus.Cancelled;
        sub.cancelledAt = block.timestamp;
        
        // Clear active subscription
        activeSubscription[sub.subscriber][sub.planId] = bytes32(0);
        plans[sub.planId].subscriberCount--;

        emit SubscriptionCancelled(subscriptionId);
    }

    // ============================================================================
    // View Functions
    // ============================================================================

    /**
     * @notice Check if a vault has an active subscription to a plan
     */
    function hasActiveSubscription(
        address vault,
        bytes32 planId
    ) external view returns (bool) {
        bytes32 subId = activeSubscription[vault][planId];
        if (subId == bytes32(0)) return false;
        
        Subscription storage sub = subscriptions[subId];
        return sub.status == SubscriptionStatus.Active &&
               block.timestamp <= sub.currentPeriodEnd + gracePeriod;
    }

    /**
     * @notice Get all subscriptions for a vault
     */
    function getVaultSubscriptions(
        address vault
    ) external view returns (bytes32[] memory) {
        return vaultSubscriptions[vault];
    }

    /**
     * @notice Get subscription details
     */
    function getSubscription(
        bytes32 subscriptionId
    ) external view returns (Subscription memory) {
        return subscriptions[subscriptionId];
    }

    /**
     * @notice Get plan details
     */
    function getPlan(bytes32 planId) external view returns (Plan memory) {
        return plans[planId];
    }

    /**
     * @notice Get all plans
     */
    function getAllPlans() external view returns (Plan[] memory) {
        Plan[] memory allPlans = new Plan[](planIds.length);
        for (uint256 i = 0; i < planIds.length; i++) {
            allPlans[i] = plans[planIds[i]];
        }
        return allPlans;
    }

    // ============================================================================
    // Admin Functions
    // ============================================================================

    /**
     * @notice Update grace period
     */
    function setGracePeriod(uint256 newPeriod) external onlyOwner {
        gracePeriod = newPeriod;
    }

    // ============================================================================
    // Fallback
    // ============================================================================

    receive() external payable {}
}
