import { MetaTransaction } from 'ethers-multisend'
import {
  Chain,
  Hash,
  PublicClient,
  RpcTransactionReceipt,
  Transport
} from 'viem'

import { ComethWallet } from '../../ComethWallet'
import { getTransaction } from '../customActions/getTransaction'
import { sendTransaction } from '../customActions/sendTransaction'

export type ComethWalletActions = {
  sendTransaction: (args: MetaTransaction) => Promise<Hash>
  getTransaction: (args: Hash) => Promise<RpcTransactionReceipt>
}

export const comethWalletActions = (
  wallet: ComethWallet
): ((client: PublicClient<Transport, Chain>) => ComethWalletActions) => {
  return (client) => ({
    sendTransaction: async (args) => await sendTransaction(wallet, args),
    getTransaction: async (args) => await getTransaction(client, wallet, args)
  })
}

export { getTransaction, sendTransaction }
