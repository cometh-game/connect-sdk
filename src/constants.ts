export const API_URL = 'https://api.connect.cometh.io/'
export const DEFAULT_CHAIN_ID = 137
export const DEFAULT_RPC_TARGET = 'https://polygon-rpc.com'
export const networks = {
  // Default network: Polygon
  137: {
    RPCUrl: process.env.RPC_URL_POLYGON || 'https://polygon-rpc.com',
    networkName: 'Polygon',
    P256FactoryContractAddress: '0x9Ac319aB147b4f27950676Da741D6184cc305894',
    multisendContractAddress: '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761'
  },
  80001: {
    RPCUrl: process.env.RPC_URL_MUMBAI || 'https://rpc-mumbai.maticvigil.com',
    networkName: 'Mumbai',
    P256FactoryContractAddress: '0x9Ac319aB147b4f27950676Da741D6184cc305894',
    multisendContractAddress: '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761'
  }
}
export const GAS_GAP_TOLERANCE = 10
export const DEFAULT_BASE_GAS = 80000
export const DEFAULT_REWARD_PERCENTILE = 80
export const BLOCK_EVENT_GAP = -500
export const EIP712_SAFE_MESSAGE_TYPE = {
  // "SafeMessage(bytes message)"
  SafeMessage: [{ type: 'bytes', name: 'message' }]
}
export const EIP712_SAFE_TX_TYPES = {
  SafeTx: [
    { type: 'address', name: 'to' },
    { type: 'uint256', name: 'value' },
    { type: 'bytes', name: 'data' },
    { type: 'uint8', name: 'operation' },
    { type: 'uint256', name: 'safeTxGas' },
    { type: 'uint256', name: 'baseGas' },
    { type: 'uint256', name: 'gasPrice' },
    { type: 'address', name: 'gasToken' },
    { type: 'address', name: 'refundReceiver' },
    { type: 'uint256', name: 'nonce' }
  ]
}
export const challengePrefix = '226368616c6c656e6765223a'
export const P256SignerCreationCode =
  '0x60c060405234801561001057600080fd5b506040516107dd3803806107dd83398101604081905261002f9161003d565b60809190915260a052610061565b6000806040838503121561005057600080fd5b505080516020909101519092909150565b60805160a05161074b6100926000396000818160e70152610216015260008181605601526101f0015261074b6000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c80630c55699c146100515780631626ba7e1461008b57806320c13b0b146100cf578063a56dfe4a146100e2575b600080fd5b6100787f000000000000000000000000000000000000000000000000000000000000000081565b6040519081526020015b60405180910390f35b61009e610099366004610421565b610109565b6040517fffffffff000000000000000000000000000000000000000000000000000000009091168152602001610082565b61009e6100dd366004610468565b61015e565b6100787f000000000000000000000000000000000000000000000000000000000000000081565b60006101368360405160200161012191815260200190565b60405160208183030381529060405283610192565b507f1626ba7e0000000000000000000000000000000000000000000000000000000092915050565b600061016a8383610192565b507f20c13b0b0000000000000000000000000000000000000000000000000000000092915050565b600082805190602001209050600080600080858060200190518101906101b89190610533565b935093509350935060007304641D72fbE21Db00c1d2f04d19E8206fB8D1eD3630d5efec9866001878a888860405180604001604052807f000000000000000000000000000000000000000000000000000000000000000081526020017f00000000000000000000000000000000000000000000000000000000000000008152506040518863ffffffff1660e01b815260040161025a9796959493929190610664565b602060405180830381865af4158015610277573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061029b91906106ec565b9050806102d4576040517f8baa579f00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5050505050505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6040805190810167ffffffffffffffff81118282101715610330576103306102de565b60405290565b604051601f82017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016810167ffffffffffffffff8111828210171561037d5761037d6102de565b604052919050565b600067ffffffffffffffff82111561039f5761039f6102de565b50601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe01660200190565b600082601f8301126103dc57600080fd5b81356103ef6103ea82610385565b610336565b81815284602083860101111561040457600080fd5b816020850160208301376000918101602001919091529392505050565b6000806040838503121561043457600080fd5b82359150602083013567ffffffffffffffff81111561045257600080fd5b61045e858286016103cb565b9150509250929050565b6000806040838503121561047b57600080fd5b823567ffffffffffffffff8082111561049357600080fd5b61049f868387016103cb565b935060208501359150808211156104b557600080fd5b5061045e858286016103cb565b60005b838110156104dd5781810151838201526020016104c5565b50506000910152565b600082601f8301126104f757600080fd5b81516105056103ea82610385565b81815284602083860101111561051a57600080fd5b61052b8260208301602087016104c2565b949350505050565b60008060008060a0858703121561054957600080fd5b845167ffffffffffffffff8082111561056157600080fd5b61056d888389016104e6565b955060209150818701518181111561058457600080fd5b61059089828a016104e6565b955050506040860151925086607f8701126105aa57600080fd5b6105b261030d565b8060a08801898111156105c457600080fd5b606089015b818110156105e057805184529284019284016105c9565b505080935050505092959194509250565b600081518084526106098160208601602086016104c2565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0169290920160200192915050565b8060005b600281101561065e57815184526020938401939091019060010161063f565b50505050565b60006101208083526106788184018b6105f1565b90507fff000000000000000000000000000000000000000000000000000000000000008960f81b16602084015282810360408401526106b781896105f1565b9150508560608301528460808301526106d360a083018561063b565b6106e060e083018461063b565b98975050505050505050565b6000602082840312156106fe57600080fd5b8151801515811461070e57600080fd5b939250505056fea2646970667358221220ee8ed319334e4dc8d418cc771e5c5a1619dbc07de1e6cb3983d9ab34ae5ddd1d64736f6c63430008110033'

export const Pbkdf2Iterations = Number(process.env.PBKDF2_ITERATIONS) || 1000000

export const ADD_OWNER_FUNCTION_SELECTOR = '0x0d582f13'
