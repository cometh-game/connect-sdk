import { JsonRpcSigner } from '@ethersproject/providers'
import { Bytes, Wallet } from 'ethers'
import { hashMessage } from 'ethers/lib/utils'
import { SiweMessage } from 'siwe'

import { EIP712_SAFE_MESSAGE_TYPE } from '../constants'
import { API } from '../services'
import siweService from '../services/siweService'

export class IConnectionSigning {
  readonly chainId: string
  protected API: API

  constructor(chainId: string, apiKey: string, baseUrl?: string) {
    this.chainId = chainId!
    this.API = new API(apiKey, baseUrl)
  }

  async signAndConnect(
    walletAddress: string,
    signer: JsonRpcSigner | Wallet
  ): Promise<void> {
    const nonce = await this.API.getNonce(walletAddress)

    const message: SiweMessage = siweService.createMessage(
      walletAddress,
      nonce,
      +this.chainId
    )

    const signature = await this.signMessage(
      walletAddress,
      message.prepareMessage(),
      signer
    )

    await this.API.connect({
      message,
      signature,
      walletAddress
    })
  }

  private async signMessage(
    walletAddress: string,
    messageToSign: string | Bytes,
    signer: JsonRpcSigner | Wallet
  ): Promise<string> {
    if (typeof messageToSign === 'string') {
      messageToSign = hashMessage(messageToSign)
    }

    if (!signer) throw new Error('Sign message: missing signer')

    return await signer._signTypedData(
      {
        chainId: this.chainId,
        verifyingContract: walletAddress
      },
      EIP712_SAFE_MESSAGE_TYPE,
      { message: messageToSign }
    )
  }
}
