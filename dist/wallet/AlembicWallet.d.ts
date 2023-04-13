import {
  JsonRpcSigner,
  TransactionReceipt,
  Web3Provider
} from '@ethersproject/providers'
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types'
import { BigNumber, Bytes } from 'ethers'

import { EOAConstructor } from './adapters'
import { SendTransactionResponse, TransactionStatus, UserInfos } from './types'
export declare const EIP712_SAFE_MESSAGE_TYPE: {
  SafeMessage: {
    type: string
    name: string
  }[]
}
export interface AlembicWalletConfig {
  eoaAdapter?: EOAConstructor
  chainId?: number
  rpcTarget?: string
  apiKey: string
}
export declare class AlembicWallet {
  private eoaAdapter
  readonly chainId: number
  private rpcTarget
  private connected
  private BASE_GAS
  private REWARD_PERCENTILE
  private sponsoredAddresses?
  private safeSdk?
  private API
  constructor({ eoaAdapter, chainId, rpcTarget, apiKey }: AlembicWalletConfig)
  /**
   * Connection Section
   */
  connect(): Promise<void>
  getConnected(): boolean
  getUserInfos(): Promise<UserInfos>
  getSmartWalletAddress(): string
  private _createMessage
  logout(): Promise<void>
  /**
   * Signing Section
   */
  getOwnerProvider(): Web3Provider
  getSigner(): JsonRpcSigner | undefined
  signMessage(messageToSign: string | Bytes): Promise<string>
  /**
   * Transaction Section
   */
  sendTransaction(
    userAddress: string,
    safeTxData: SafeTransactionDataPartial
  ): Promise<SendTransactionResponse>
  private _isSponsoredAddress
  getRelayTxStatus(relayId: string): Promise<TransactionStatus>
  waitRelay(relayId: string): Promise<TransactionReceipt>
  estimateTransactionGas(
    userAddress: string,
    safeTxData: SafeTransactionDataPartial
  ): Promise<{
    safeTxGas: BigNumber
    baseGas: number
    gasPrice: BigNumber
  }>
}
