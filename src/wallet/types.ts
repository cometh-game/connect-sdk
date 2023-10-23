export enum RelayStatus {
  MINED = 'mined'
}

export enum SupportedNetworks {
  POLYGON = '0x89',
  MUMBAI = '0x013881',
  AVALANCHE = '0xa86a',
  FUJI = '0xa869',
  GNOSIS = '0x64',
  CHIADO = '0x27d8'
}

export declare enum OperationType {
  Call = 0,
  DelegateCall = 1
}

export interface MetaTransactionData {
  readonly to: string
  readonly value: string
  readonly data: string
}

export interface SafeTransactionDataPartial extends MetaTransactionData {
  readonly operation?: OperationType | string
  readonly safeTxGas?: number | string
  readonly baseGas?: number | string
  readonly gasPrice?: number | string
  readonly gasToken?: number | string
  readonly refundReceiver?: string
  readonly nonce?: number | string
}

export type UserNonceType = {
  walletAddress: string
  connectionNonce: string
}
export type SponsoredTransaction = {
  projectId: string
  targetAddress: string
}
export type RelayTransactionType = {
  safeTxData: SafeTransactionDataPartial
  signatures: string
  walletAddress: string
}

export type TransactionStatus = {
  hash: string
  status: string
}

export type SendTransactionResponse = {
  safeTxHash: string
}

export interface WalletUiConfig {
  displayValidationModal: boolean
}

export type WebAuthnSigner = {
  projectId: string
  userId: string
  chainId: string
  walletAddress: string
  publicKeyId: string
  publicKeyX: string
  publicKeyY: string
  signerAddress: string
  deviceData: DeviceData
}

export type UIConfig = {
  displayValidationModal: boolean
}

export type WalletInfos = {
  address: string
  connectionDate: Date
  creationDate: Date
  userId: string
}

export type DeviceData = {
  browser: string
  os: string
  platform: string
}

export enum NewSignerRequestType {
  WEBAUTHN = 'WEBAUTHN',
  BURNER_WALLET = 'BURNER_WALLET'
}

export type Signer = {
  walletAddress: string
  signerAddress: string
  deviceData: DeviceData
  publicKeyId?: string
  publicKeyX?: string
  publicKeyY?: string
}

export type NewSignerRequestBody = Signer & {
  type: NewSignerRequestType
}

export type NewSignerRequest = NewSignerRequestBody & {
  projectId: string
  userId: string
  chainId: string
}

export type ProjectParams = {
  chainId: string
  P256FactoryContractAddress: string
  multisendContractAddress: string
}
