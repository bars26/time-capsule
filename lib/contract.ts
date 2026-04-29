// Time Capsule V2 contract on Base Sepolia
export const TIME_CAPSULE_ADDRESS =
  "0x648d13777cD83A15e7C9421590f615B83EAca793" as const;

export const TIME_CAPSULE_ABI = [
  // ---------- Constructor ----------
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },

  // ---------- Core write functions ----------
  {
    inputs: [
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "string", name: "ipfsHash", type: "string" },
      { internalType: "uint256", name: "unlockTime", type: "uint256" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "coverEmoji", type: "string" },
    ],
    name: "createCapsule",
    outputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "hideCapsule",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ---------- Read functions ----------
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "getCapsule",
    outputs: [
      { internalType: "address", name: "sender", type: "address" },
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "string", name: "ipfsHash", type: "string" },
      { internalType: "uint256", name: "unlockTime", type: "uint256" },
      { internalType: "uint256", name: "createdAt", type: "uint256" },
      { internalType: "bool", name: "isHidden", type: "bool" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "coverEmoji", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getSentCapsuleIds",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getReceivedCapsuleIds",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },

  // ---------- Public state variable getters ----------
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "capsules",
    outputs: [
      { internalType: "address", name: "sender", type: "address" },
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "string", name: "ipfsHash", type: "string" },
      { internalType: "uint256", name: "unlockTime", type: "uint256" },
      { internalType: "uint256", name: "createdAt", type: "uint256" },
      { internalType: "bool", name: "isHidden", type: "bool" },
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "coverEmoji", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalCapsules",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DELETION_WINDOW",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_UNLOCK_OFFSET",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_TITLE_LENGTH",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // ---------- Admin ----------
  {
    inputs: [{ internalType: "uint256", name: "newFee", type: "uint256" }],
    name: "setFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ---------- Events ----------
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "uint256", name: "unlockTime", type: "uint256" },
    ],
    name: "CapsuleCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
    ],
    name: "CapsuleHidden",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint256", name: "newFee", type: "uint256" },
    ],
    name: "FeeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Withdrawn",
    type: "event",
  },

  // ---------- Errors ----------
  { inputs: [], name: "InvalidRecipient", type: "error" },
  { inputs: [], name: "UnlockTimeTooSoon", type: "error" },
  { inputs: [], name: "EmptyIpfsHash", type: "error" },
  { inputs: [], name: "TitleTooLong", type: "error" },
  { inputs: [], name: "InsufficientFee", type: "error" },
  { inputs: [], name: "NotSender", type: "error" },
  { inputs: [], name: "AlreadyHidden", type: "error" },
  { inputs: [], name: "DeletionWindowClosed", type: "error" },
  { inputs: [], name: "NotOwner", type: "error" },
  { inputs: [], name: "WithdrawFailed", type: "error" },
] as const;
