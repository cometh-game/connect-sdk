import { ethers } from 'ethers'

import { OwnerAddress } from '../types'

export interface EOAAdapter {
  init(chainId: any, rpcTarget: any): Promise<void>
  logout(): Promise<void>
  getAccount(): Promise<OwnerAddress | null>
  getSigner(): Promise<ethers.Signer | null>
}
