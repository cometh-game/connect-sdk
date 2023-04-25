import {
  TransactionReceipt,
  TransactionResponse
} from '@ethersproject/abstract-provider'
import { BigNumber } from 'ethers'
import { AccessList } from 'ethers/lib/utils'

import { AlembicProvider } from './AlembicProvider'
import { AlembicWallet } from './AlembicWallet'

export class RelayTransactionResponse implements TransactionResponse {
  hash: string
  blockNumber?: number | undefined
  blockHash?: string | undefined
  timestamp?: number | undefined
  confirmations: number
  from: string
  raw?: string | undefined
  to?: string | undefined
  nonce: number
  gasLimit: BigNumber
  gasPrice?: BigNumber | undefined
  data: string
  value: BigNumber
  chainId: number
  r?: string | undefined
  s?: string | undefined
  v?: number | undefined
  type?: number | null | undefined
  accessList?: AccessList | undefined
  maxPriorityFeePerGas?: BigNumber | undefined
  maxFeePerGas?: BigNumber | undefined

  constructor(
    private safeTxHash: string,
    private provider: AlembicProvider,
    private alembicWallet: AlembicWallet
  ) {
    this.hash = '0x0'
    this.confirmations = 0
    this.from = this.alembicWallet.getAddress()
    this.nonce = 0
    this.gasLimit = BigNumber.from(0)
    this.value = BigNumber.from(0)
    this.data = '0x0'
    this.chainId = 0
  }

  public getSafeTxHash(): string {
    return this.safeTxHash
  }

  public async wait(): Promise<TransactionReceipt> {
    const txEvent = await this.alembicWallet.getExecTransactionEvent(
      this.getSafeTxHash()
    )

    if (txEvent) {
      const txResponse = await this.provider.getTransactionReceipt(
        txEvent.transactionHash
      )

      this.hash = txResponse.transactionHash
      this.confirmations = txResponse.confirmations
      this.from = txResponse.from
      this.data = txEvent.data
      this.value = txEvent.args[1]

      const isDeployed = await this.alembicWallet.isDeployed()

      if (!isDeployed) {
        return this.wait()
      }

      try {
        return this.provider.getTransactionReceipt(txEvent.transactionHash)
      } catch (error) {
        return error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return this.wait()
  }
}
