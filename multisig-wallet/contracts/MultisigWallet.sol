// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MultisigWallet
 * @notice A fully on-chain multisig wallet contract that requires M-of-N signer
 *         approvals before executing transactions. This is the "on-chain" alternative
 *         to the Veridex SDK's off-chain multisig approach.
 *
 * Features:
 *   - M-of-N threshold signatures
 *   - Native ETH and ERC-20 token transfers
 *   - Arbitrary contract calls (execute)
 *   - Signer management (add/remove) via proposals
 *   - Threshold updates via proposals
 *   - Proposal expiration (configurable TTL)
 *   - Event-driven notification support
 */
contract MultisigWallet {
    // ========================================================================
    // Types
    // ========================================================================

    enum ProposalType {
        Transfer,       // Send native currency
        TokenTransfer,  // Send ERC-20 tokens
        Execute,        // Arbitrary contract call
        AddSigner,      // Add a new signer
        RemoveSigner,   // Remove an existing signer
        ChangeThreshold // Update the approval threshold
    }

    enum ProposalStatus {
        Pending,
        Approved,
        Executed,
        Rejected,
        Expired
    }

    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        ProposalStatus status;
        address proposer;
        // Transfer fields
        address target;
        uint256 value;
        bytes data;
        // Signer management fields
        address signerAddress;
        uint256 newThreshold;
        // Metadata
        string title;
        string description;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 approvalCount;
        uint256 rejectionCount;
        uint256 executedAt;
    }

    // ========================================================================
    // State
    // ========================================================================

    string public name;
    uint256 public threshold;
    uint256 public proposalCount;
    uint256 public proposalTTL; // seconds until a proposal expires

    mapping(address => bool) public isSigner;
    address[] public signers;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    // ========================================================================
    // Events
    // ========================================================================

    event WalletCreated(string name, address[] signers, uint256 threshold);
    event ProposalCreated(uint256 indexed proposalId, ProposalType proposalType, address indexed proposer, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool approved);
    event ProposalApproved(uint256 indexed proposalId);
    event ProposalRejected(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);
    event ProposalExpired(uint256 indexed proposalId);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);
    event Deposited(address indexed sender, uint256 amount);

    // ========================================================================
    // Modifiers
    // ========================================================================

    modifier onlySigner() {
        require(isSigner[msg.sender], "Not a signer");
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Only callable via proposal execution");
        _;
    }

    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Proposal does not exist");
        _;
    }

    // ========================================================================
    // Constructor
    // ========================================================================

    constructor(
        string memory _name,
        address[] memory _signers,
        uint256 _threshold,
        uint256 _proposalTTL
    ) {
        require(_signers.length > 0, "Must have at least one signer");
        require(_threshold > 0 && _threshold <= _signers.length, "Invalid threshold");
        require(_proposalTTL > 0, "TTL must be positive");

        name = _name;
        threshold = _threshold;
        proposalTTL = _proposalTTL;

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer != address(0), "Invalid signer address");
            require(!isSigner[signer], "Duplicate signer");
            isSigner[signer] = true;
            signers.push(signer);
        }

        emit WalletCreated(_name, _signers, _threshold);
    }

    // ========================================================================
    // Receive / Fallback
    // ========================================================================

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // ========================================================================
    // Proposal Creation
    // ========================================================================

    /// @notice Create a native currency transfer proposal
    function proposeTransfer(
        string calldata _title,
        string calldata _description,
        address _to,
        uint256 _value
    ) external onlySigner returns (uint256) {
        require(_to != address(0), "Invalid recipient");
        return _createProposal(
            ProposalType.Transfer, _title, _description,
            _to, _value, "", address(0), 0
        );
    }

    /// @notice Create an ERC-20 token transfer proposal
    function proposeTokenTransfer(
        string calldata _title,
        string calldata _description,
        address _token,
        address _to,
        uint256 _amount
    ) external onlySigner returns (uint256) {
        require(_token != address(0), "Invalid token");
        require(_to != address(0), "Invalid recipient");
        // Encode ERC-20 transfer(address,uint256)
        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", _to, _amount);
        return _createProposal(
            ProposalType.TokenTransfer, _title, _description,
            _token, 0, data, address(0), 0
        );
    }

    /// @notice Create an arbitrary contract call proposal
    function proposeExecute(
        string calldata _title,
        string calldata _description,
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external onlySigner returns (uint256) {
        require(_target != address(0), "Invalid target");
        return _createProposal(
            ProposalType.Execute, _title, _description,
            _target, _value, _data, address(0), 0
        );
    }

    /// @notice Create a proposal to add a new signer
    function proposeAddSigner(
        string calldata _title,
        string calldata _description,
        address _newSigner,
        uint256 _newThreshold
    ) external onlySigner returns (uint256) {
        require(_newSigner != address(0), "Invalid signer address");
        require(!isSigner[_newSigner], "Already a signer");
        require(_newThreshold > 0 && _newThreshold <= signers.length + 1, "Invalid threshold");
        return _createProposal(
            ProposalType.AddSigner, _title, _description,
            address(0), 0, "", _newSigner, _newThreshold
        );
    }

    /// @notice Create a proposal to remove a signer
    function proposeRemoveSigner(
        string calldata _title,
        string calldata _description,
        address _signer,
        uint256 _newThreshold
    ) external onlySigner returns (uint256) {
        require(isSigner[_signer], "Not a signer");
        require(signers.length - 1 >= _newThreshold, "Threshold too high after removal");
        require(_newThreshold > 0, "Threshold must be positive");
        return _createProposal(
            ProposalType.RemoveSigner, _title, _description,
            address(0), 0, "", _signer, _newThreshold
        );
    }

    /// @notice Create a proposal to change the threshold
    function proposeChangeThreshold(
        string calldata _title,
        string calldata _description,
        uint256 _newThreshold
    ) external onlySigner returns (uint256) {
        require(_newThreshold > 0 && _newThreshold <= signers.length, "Invalid threshold");
        return _createProposal(
            ProposalType.ChangeThreshold, _title, _description,
            address(0), 0, "", address(0), _newThreshold
        );
    }

    // ========================================================================
    // Voting
    // ========================================================================

    /// @notice Approve a proposal
    function approve(uint256 _proposalId) external onlySigner proposalExists(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        _checkVotable(p, _proposalId);

        hasVoted[_proposalId][msg.sender] = true;
        hasApproved[_proposalId][msg.sender] = true;
        p.approvalCount++;

        emit VoteCast(_proposalId, msg.sender, true);

        if (p.approvalCount >= threshold) {
            p.status = ProposalStatus.Approved;
            emit ProposalApproved(_proposalId);
        }
    }

    /// @notice Reject a proposal
    function reject(uint256 _proposalId) external onlySigner proposalExists(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        _checkVotable(p, _proposalId);

        hasVoted[_proposalId][msg.sender] = true;
        p.rejectionCount++;

        emit VoteCast(_proposalId, msg.sender, false);

        // If remaining voters can't reach threshold, auto-reject
        uint256 remainingVoters = signers.length - p.approvalCount - p.rejectionCount;
        if (remainingVoters + p.approvalCount < threshold) {
            p.status = ProposalStatus.Rejected;
            emit ProposalRejected(_proposalId);
        }
    }

    // ========================================================================
    // Execution
    // ========================================================================

    /// @notice Execute an approved proposal
    function execute(uint256 _proposalId) external onlySigner proposalExists(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.Approved, "Proposal not approved");

        // Check expiration
        if (block.timestamp > p.expiresAt) {
            p.status = ProposalStatus.Expired;
            emit ProposalExpired(_proposalId);
            revert("Proposal has expired");
        }

        p.status = ProposalStatus.Executed;
        p.executedAt = block.timestamp;

        if (p.proposalType == ProposalType.Transfer) {
            (bool success, ) = p.target.call{value: p.value}("");
            require(success, "Transfer failed");
        } else if (p.proposalType == ProposalType.TokenTransfer) {
            (bool success, ) = p.target.call(p.data);
            require(success, "Token transfer failed");
        } else if (p.proposalType == ProposalType.Execute) {
            (bool success, ) = p.target.call{value: p.value}(p.data);
            require(success, "Execution failed");
        } else if (p.proposalType == ProposalType.AddSigner) {
            _addSigner(p.signerAddress);
            if (p.newThreshold != threshold) {
                _changeThreshold(p.newThreshold);
            }
        } else if (p.proposalType == ProposalType.RemoveSigner) {
            _removeSigner(p.signerAddress);
            if (p.newThreshold != threshold) {
                _changeThreshold(p.newThreshold);
            }
        } else if (p.proposalType == ProposalType.ChangeThreshold) {
            _changeThreshold(p.newThreshold);
        }

        emit ProposalExecuted(_proposalId, msg.sender);
    }

    // ========================================================================
    // View Functions
    // ========================================================================

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    function getProposal(uint256 _proposalId) external view proposalExists(_proposalId) returns (Proposal memory) {
        return proposals[_proposalId];
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function isProposalExpired(uint256 _proposalId) external view proposalExists(_proposalId) returns (bool) {
        return block.timestamp > proposals[_proposalId].expiresAt;
    }

    function getVoteStatus(uint256 _proposalId, address _signer) external view proposalExists(_proposalId) returns (bool voted, bool approved) {
        voted = hasVoted[_proposalId][_signer];
        approved = hasApproved[_proposalId][_signer];
    }

    // ========================================================================
    // Internal Functions
    // ========================================================================

    function _createProposal(
        ProposalType _type,
        string calldata _title,
        string calldata _description,
        address _target,
        uint256 _value,
        bytes memory _data,
        address _signerAddress,
        uint256 _newThreshold
    ) internal returns (uint256) {
        proposalCount++;
        uint256 id = proposalCount;

        Proposal storage p = proposals[id];
        p.id = id;
        p.proposalType = _type;
        p.status = ProposalStatus.Pending;
        p.proposer = msg.sender;
        p.target = _target;
        p.value = _value;
        p.data = _data;
        p.signerAddress = _signerAddress;
        p.newThreshold = _newThreshold;
        p.title = _title;
        p.description = _description;
        p.createdAt = block.timestamp;
        p.expiresAt = block.timestamp + proposalTTL;

        emit ProposalCreated(id, _type, msg.sender, _title);

        // Auto-approve by proposer
        hasVoted[id][msg.sender] = true;
        hasApproved[id][msg.sender] = true;
        p.approvalCount = 1;
        emit VoteCast(id, msg.sender, true);

        // Check if threshold already met (e.g., 1-of-N)
        if (p.approvalCount >= threshold) {
            p.status = ProposalStatus.Approved;
            emit ProposalApproved(id);
        }

        return id;
    }

    function _checkVotable(Proposal storage p, uint256 _proposalId) internal view {
        require(p.status == ProposalStatus.Pending, "Proposal not pending");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");
        require(block.timestamp <= p.expiresAt, "Proposal expired");
    }

    function _addSigner(address _signer) internal {
        require(!isSigner[_signer], "Already a signer");
        isSigner[_signer] = true;
        signers.push(_signer);
        emit SignerAdded(_signer);
    }

    function _removeSigner(address _signer) internal {
        require(isSigner[_signer], "Not a signer");
        require(signers.length > 1, "Cannot remove last signer");

        isSigner[_signer] = false;

        // Swap and pop
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == _signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        emit SignerRemoved(_signer);
    }

    function _changeThreshold(uint256 _newThreshold) internal {
        require(_newThreshold > 0 && _newThreshold <= signers.length, "Invalid threshold");
        uint256 oldThreshold = threshold;
        threshold = _newThreshold;
        emit ThresholdChanged(oldThreshold, _newThreshold);
    }
}
