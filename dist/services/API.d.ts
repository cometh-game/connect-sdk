import { SiweMessage } from 'siwe'

import {
  RelayTransactionType,
  TransactionStatus,
  UserNonceType
} from '../wallet/types'
export declare const api: import('axios').AxiosInstance
export declare class API {
  constructor(apiKey: string)
  getNonce(account: string): Promise<UserNonceType>
  connectToAlembicWallet({
    message,
    signature,
    ownerAddress
  }: {
    message: SiweMessage
    signature: string
    ownerAddress: string
  }): Promise<string>
  relayTransaction({
    smartWalletAddress,
    safeTxData,
    signatures
  }: RelayTransactionType): Promise<string>
  getRelayTxStatus(relayId: string): Promise<TransactionStatus>
}
