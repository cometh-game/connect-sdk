import {
  BaseProvider,
  Network,
  TransactionReceipt,
  TransactionResponse
} from '@ethersproject/providers'
import { Signer } from 'ethers'

import { TransactionStatus } from '../wallet/types'
import { AlembicSigner } from './AlembicSigner'
import { AlembicWallet } from './AlembicWallet'
export declare class AlembicProvider extends BaseProvider {
  private alembicWallet
  readonly signer: AlembicSigner
  constructor(alembicWallet: AlembicWallet)
  getSigner(): Signer
  perform(method: string, params: any): Promise<any>
  send(method: string, params: any): Promise<any>
  getTransaction(safeTxHash: string): Promise<TransactionResponse>
  wait(safeTxHash: string): Promise<TransactionReceipt>
  getRelayStatus(safeTxHash: string): Promise<TransactionStatus>
  getTransactionReceipt(
    transactionHash: string | Promise<string>
  ): Promise<TransactionReceipt>
  waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt>
  detectNetwork(): Promise<Network>
}
