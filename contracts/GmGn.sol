// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GmGn
 * @notice A tiny onchain "GM / GN" greeter for Time Capsule. Each greeting is a
 *         cheap onchain transaction that:
 *           - optionally collects a small fee (owner-configurable, can be 0),
 *           - tracks a per-user daily streak (consecutive days),
 *           - tracks per-user and global greeting counts.
 *
 *         Designed to drive light, recurring daily engagement and onchain
 *         activity. The frontend appends the app's Builder Code as a tx data
 *         suffix so base.dev attributes the activity to the app.
 *
 *         Greetings do not store any user content; only counters and events.
 */
contract GmGn {
    // ---------- Types ----------
    enum Kind {
        GM,
        GN
    }

    // ---------- Storage ----------
    address public owner;
    uint256 public fee; // wei required per greeting (may be 0)
    uint256 public totalGreets;

    mapping(address => uint256) public greetCount; // lifetime greets per user
    mapping(address => uint256) public lastGreetDay; // unix day index of last greet
    mapping(address => uint256) public streak; // consecutive-day streak

    // ---------- Events ----------
    event Greeted(
        address indexed user,
        Kind kind,
        uint256 dayIndex,
        uint256 streak,
        uint256 totalCount,
        uint256 timestamp
    );
    event FeeUpdated(uint256 newFee);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnerTransferred(address indexed from, address indexed to);

    // ---------- Errors ----------
    error InsufficientFee();
    error NotOwner();
    error WithdrawFailed();
    error ZeroAddress();

    // ---------- Modifiers ----------
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------- Constructor ----------
    constructor(uint256 initialFee) {
        owner = msg.sender;
        fee = initialFee;
    }

    // ---------- Core ----------

    /// @notice Say GM or GN onchain. Pays at least `fee`; overpayment is kept
    ///         (treated as a tip). Updates the caller's daily streak.
    function greet(Kind kind) external payable {
        if (msg.value < fee) revert InsufficientFee();

        uint256 today = block.timestamp / 1 days;
        uint256 last = lastGreetDay[msg.sender];

        // Only adjust the streak when this is the first greet of a new day.
        if (last != today) {
            if (last != 0 && last == today - 1) {
                streak[msg.sender] += 1; // consecutive day
            } else {
                streak[msg.sender] = 1; // first ever, or streak broken
            }
            lastGreetDay[msg.sender] = today;
        }

        greetCount[msg.sender] += 1;
        totalGreets += 1;

        emit Greeted(
            msg.sender,
            kind,
            today,
            streak[msg.sender],
            greetCount[msg.sender],
            block.timestamp
        );
    }

    // ---------- Views ----------

    /// @notice Returns a user's current stats. `streakActive` is false if the
    ///         streak has lapsed (they didn't greet today or yesterday).
    function statsOf(address user)
        external
        view
        returns (
            uint256 count,
            uint256 currentStreak,
            uint256 lastDay,
            bool greetedToday,
            bool streakActive
        )
    {
        uint256 today = block.timestamp / 1 days;
        uint256 last = lastGreetDay[user];
        count = greetCount[user];
        currentStreak = streak[user];
        lastDay = last;
        greetedToday = (last == today);
        streakActive = (last == today || last == today - 1);
    }

    // ---------- Admin ----------

    function setFee(uint256 newFee) external onlyOwner {
        fee = newFee;
        emit FeeUpdated(newFee);
    }

    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool ok, ) = payable(owner).call{value: bal}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, bal);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }
}
