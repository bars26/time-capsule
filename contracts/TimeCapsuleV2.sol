// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Time Capsule V2
 * @notice Onchain time-locked messages with optional gift mode (sender ≠ recipient).
 *         Messages are stored as IPFS hashes pointing to client-side encrypted blobs;
 *         only the recipient can decrypt. Senders may hide a capsule within 1 hour
 *         of creation (soft delete — onchain data persists, but UI honors the flag).
 */
contract TimeCapsuleV2 {
    // ---------- Types ----------

    struct Capsule {
        address sender;
        address recipient;
        string ipfsHash;     // pointer to encrypted message blob
        uint256 unlockTime;  // unix timestamp when recipient may decrypt
        uint256 createdAt;   // unix timestamp at creation (deletion window)
        bool isHidden;       // soft delete flag, sender-controlled within deletion window
        string title;        // optional, max 50 chars, may be empty
        string coverEmoji;   // optional, may be empty
    }

    // ---------- Storage ----------

    mapping(uint256 => Capsule) public capsules;
    mapping(address => uint256[]) private _sentBy;
    mapping(address => uint256[]) private _receivedBy;

    uint256 public totalCapsules;
    uint256 public fee = 0.0001 ether;
    address public owner;

    // ---------- Constants ----------

    uint256 public constant DELETION_WINDOW = 1 hours;
    uint256 public constant MIN_UNLOCK_OFFSET = 5 minutes;
    uint256 public constant MAX_TITLE_LENGTH = 50;

    // ---------- Events ----------

    event CapsuleCreated(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 unlockTime
    );
    event CapsuleHidden(uint256 indexed id);
    event FeeUpdated(uint256 newFee);
    event Withdrawn(address indexed to, uint256 amount);

    // ---------- Errors ----------

    error InvalidRecipient();
    error UnlockTimeTooSoon();
    error EmptyIpfsHash();
    error TitleTooLong();
    error InsufficientFee();
    error NotSender();
    error AlreadyHidden();
    error DeletionWindowClosed();
    error NotOwner();
    error WithdrawFailed();

    // ---------- Modifiers ----------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------- Constructor ----------

    constructor() {
        owner = msg.sender;
    }

    // ---------- Core ----------

    /**
     * @notice Create a new capsule. Sender pays `fee` ETH; recipient may equal sender (self-capsule).
     * @param recipient   Address that may decrypt at/after unlockTime. Cannot be zero.
     * @param ipfsHash    IPFS pointer to the encrypted message blob.
     * @param unlockTime  Unix timestamp; must be at least 5 minutes in the future.
     * @param title       Optional title, max 50 characters. Empty string allowed.
     * @param coverEmoji  Optional cover emoji. Empty string allowed.
     * @return id         Newly created capsule id.
     */
    function createCapsule(
        address recipient,
        string calldata ipfsHash,
        uint256 unlockTime,
        string calldata title,
        string calldata coverEmoji
    ) external payable returns (uint256 id) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (unlockTime < block.timestamp + MIN_UNLOCK_OFFSET) revert UnlockTimeTooSoon();
        if (bytes(ipfsHash).length == 0) revert EmptyIpfsHash();
        if (bytes(title).length > MAX_TITLE_LENGTH) revert TitleTooLong();
        if (msg.value < fee) revert InsufficientFee();

        id = totalCapsules;
        capsules[id] = Capsule({
            sender: msg.sender,
            recipient: recipient,
            ipfsHash: ipfsHash,
            unlockTime: unlockTime,
            createdAt: block.timestamp,
            isHidden: false,
            title: title,
            coverEmoji: coverEmoji
        });

        _sentBy[msg.sender].push(id);
        // Self-capsules go in sentBy only; UI surfaces them in "Açılmaya Hazır" tab when ready.
        if (recipient != msg.sender) {
            _receivedBy[recipient].push(id);
        }

        totalCapsules++;
        emit CapsuleCreated(id, msg.sender, recipient, unlockTime);
    }

    /**
     * @notice Mark a capsule as hidden. Only the sender may call, only within DELETION_WINDOW.
     */
    function hideCapsule(uint256 id) external {
        Capsule storage c = capsules[id];
        if (c.sender != msg.sender) revert NotSender();
        if (c.isHidden) revert AlreadyHidden();
        if (block.timestamp > c.createdAt + DELETION_WINDOW) revert DeletionWindowClosed();

        c.isHidden = true;
        emit CapsuleHidden(id);
    }

    // ---------- Views ----------

    function getCapsule(uint256 id) external view returns (
        address sender,
        address recipient,
        string memory ipfsHash,
        uint256 unlockTime,
        uint256 createdAt,
        bool isHidden,
        string memory title,
        string memory coverEmoji
    ) {
        Capsule storage c = capsules[id];
        return (
            c.sender,
            c.recipient,
            c.ipfsHash,
            c.unlockTime,
            c.createdAt,
            c.isHidden,
            c.title,
            c.coverEmoji
        );
    }

    function getSentCapsuleIds(address user) external view returns (uint256[] memory) {
        return _sentBy[user];
    }

    function getReceivedCapsuleIds(address user) external view returns (uint256[] memory) {
        return _receivedBy[user];
    }

    // ---------- Admin ----------

    function setFee(uint256 newFee) external onlyOwner {
        fee = newFee;
        emit FeeUpdated(newFee);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner.call{value: balance}("");
        if (!success) revert WithdrawFailed();
        emit Withdrawn(owner, balance);
    }
}
