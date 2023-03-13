import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types'
import { SiweMessage } from 'siwe'

import { EOAConstructor } from '../../adapters'
import { TransactionStatus, UserInfos, UserNonceType } from '../../types'

export declare class AlembicWallet {
  private eoaAdapter
  private chainId
  private rpcTarget
  private isConnected
  private smartWalletAddress
  private ethProvider
  private smartWallet
  private ownerAddress
  constructor(eoaAdapter?: EOAConstructor, chainId?: number, rpcTarget?: string)
  connect(): Promise<void>
  getIsConnected(): boolean
  logout(): Promise<void>
  createMessage(
    address: string,
    nonce: UserNonceType,
    statement?: string
  ): SiweMessage
  sendTransaction(
    safeTxData: SafeTransactionDataPartial
  ): Promise<string | null>
  getRelayTxStatus(relayId: string): Promise<TransactionStatus | null>
  getUserInfos(): Promise<UserInfos>
  getOwnerAddress(): string | null
  getSmartWalletAddress(): string | null
  signMessage(message: SiweMessage): Promise<string | undefined>
}
