import { Web3Provider } from '@ethersproject/providers'
import { BigNumber, Bytes, ethers } from 'ethers'
import { SiweMessage } from 'siwe'

import {
  BLOCK_EVENT_GAP,
  DEFAULT_BASE_GAS,
  DEFAULT_CHAIN_ID,
  DEFAULT_REWARD_PERCENTILE,
  DEFAULT_RPC_TARGET,
  EIP712_SAFE_MESSAGE_TYPE,
  EIP712_SAFE_TX_TYPES,
  networks
} from '../constants'
import {
  P256SignerFactory__factory,
  Safe__factory
} from '../contracts/types/factories'
import { P256SignerFactoryInterface } from '../contracts/types/P256SignerFactory'
import { SafeInterface } from '../contracts/types/Safe'
import { API } from '../services'
import { EOAAdapter, EOAConstructor, Web3AuthAdapter } from './adapters'
import {
  MetaTransactionData,
  SafeTransactionDataPartial,
  SendTransactionResponse,
  SponsoredTransaction,
  UserInfos
} from './types'
import webAutn from './WebAutn'

export interface AlembicWalletConfig {
  eoaAdapter?: EOAConstructor
  chainId: number
  rpcTarget: string
  apiKey: string
}
export class AlembicWallet {
  private eoaAdapter: EOAAdapter
  readonly chainId: number
  private rpcTarget: string
  private connected = false
  private BASE_GAS: number
  private REWARD_PERCENTILE: number
  private API: API
  private sponsoredAddresses?: SponsoredTransaction[]
  private walletAddress?: string

  // Contract Interfaces
  readonly SafeInterface: SafeInterface = Safe__factory.createInterface()
  readonly P256FactoryContract: P256SignerFactoryInterface =
    P256SignerFactory__factory.createInterface()
  readonly P256FactoryContractAddress =
    '0xdF51EE1ab0f0Ee8A128a7BCA2d7641636A1a7EC4'

  constructor({
    eoaAdapter = Web3AuthAdapter,
    chainId,
    rpcTarget,
    apiKey
  }: AlembicWalletConfig) {
    this.chainId = chainId
    this.rpcTarget = rpcTarget
    this.eoaAdapter = new eoaAdapter()
    this.API = new API(apiKey, chainId)
    this.BASE_GAS = DEFAULT_BASE_GAS
    this.REWARD_PERCENTILE = DEFAULT_REWARD_PERCENTILE
  }

  /**
   * Connection Section
   */

  public async connect(): Promise<void> {
    // Return if does not match requirements
    if (!this.eoaAdapter) throw new Error('No EOA adapter found')
    if (!networks[this.chainId])
      throw new Error('This network is not supported')
    await this.eoaAdapter.init(this.chainId, this.rpcTarget)
    await this.eoaAdapter.connect()

    const signer = this.eoaAdapter.getEthProvider()?.getSigner()
    if (!signer) throw new Error('No signer found')

    const ownerAddress = await signer.getAddress()
    if (!ownerAddress) throw new Error('No ownerAddress found')

    const nonce = await this.API.getNonce(ownerAddress)
    this.sponsoredAddresses = await this.API.getSponsoredAddresses()

    const message: SiweMessage = this._createMessage(ownerAddress, nonce)
    const messageToSign = message.prepareMessage()
    const signature = await signer.signMessage(messageToSign)

    const walletAddress = await this.API?.connectToAlembicWallet({
      message,
      signature,
      ownerAddress
    })

    this.sponsoredAddresses = await this.API.getSponsoredAddresses()
    this.connected = true
    this.walletAddress = walletAddress
  }

  public getConnected(): boolean {
    return this.connected
  }

  public async isDeployed(): Promise<boolean> {
    try {
      await Safe__factory.connect(
        this.getAddress(),
        this.getOwnerProvider()
      ).deployed()
      return true
    } catch (error) {
      return false
    }
  }

  public async getUserInfos(): Promise<UserInfos> {
    if (!this.eoaAdapter) throw new Error('Cannot provide user infos')
    const userInfos = await this.eoaAdapter.getUserInfos()

    return {
      ...userInfos,
      ownerAddress: await this.eoaAdapter.getSigner()?.getAddress(),
      walletAddress: this.getAddress()
    }
  }

  public getAddress(): string {
    return this.walletAddress ?? ''
  }

  private _createMessage(address, nonce): SiweMessage {
    const domain = window.location.host
    const origin = window.location.origin
    const statement = `Sign in with Ethereum to Alembic`
    const message = new SiweMessage({
      domain,
      address,
      statement,
      uri: origin,
      version: '1',
      chainId: this.chainId,
      nonce: nonce?.connectionNonce
    })

    return message
  }

  public async logout(): Promise<void> {
    if (!this.eoaAdapter) throw new Error('No EOA adapter found')
    await this.eoaAdapter.logout()
    this.connected = false
  }

  public async addOwner(newOwner: string): Promise<SendTransactionResponse> {
    const tx = {
      to: this.getAddress(),
      value: '0x0',
      data: this.SafeInterface.encodeFunctionData('addOwnerWithThreshold', [
        newOwner,
        1
      ])
    }

    return await this.sendTransaction(tx)
  }

  /**
   * Signing Message Section
   */

  public getOwnerProvider(): Web3Provider {
    const provider = this.eoaAdapter.getEthProvider()
    if (!provider) throw new Error('getOwnerProvider: missing provider')
    return provider
  }

  public async signMessage(messageToSign: string | Bytes): Promise<string> {
    const signer = this.eoaAdapter.getEthProvider()?.getSigner()
    if (!signer) throw new Error('Sign message: missing signer')
    const messageHash = ethers.utils.hashMessage(messageToSign)

    const signature = await signer._signTypedData(
      {
        verifyingContract: this.getAddress(),
        chainId: this.chainId
      },
      EIP712_SAFE_MESSAGE_TYPE,
      { message: messageHash }
    )

    return signature
  }

  /**
   * Transaction Section
   */

  private _signTransaction = async (
    safeTxData: SafeTransactionDataPartial,
    nonce?: number
  ): Promise<string> => {
    const signer = this.eoaAdapter.getEthProvider()?.getSigner()
    if (!signer) throw new Error('Sign message: missing signer')

    return await signer._signTypedData(
      {
        chainId: this.chainId,
        verifyingContract: this.getAddress()
      },
      EIP712_SAFE_TX_TYPES,
      {
        to: safeTxData.to,
        value: BigNumber.from(safeTxData.value).toString(),
        data: safeTxData.data,
        operation: 0,
        safeTxGas: BigNumber.from(safeTxData.safeTxGas).toString(),
        baseGas: BigNumber.from(safeTxData.baseGas).toString(),
        gasPrice: BigNumber.from(safeTxData.gasPrice).toString(),
        gasToken: ethers.constants.AddressZero,
        refundReceiver: ethers.constants.AddressZero,
        nonce: BigNumber.from(nonce ?? (await this._getNonce())).toString()
      }
    )
  }

  private _getNonce = async (): Promise<number> => {
    return (await this.isDeployed())
      ? (
          await Safe__factory.connect(
            this.getAddress(),
            this.getOwnerProvider()
          ).nonce()
        ).toNumber()
      : 0
  }

  private _toSponsoredAddress(targetAddress: string): boolean {
    const sponsoredAddress = this.sponsoredAddresses?.find(
      (sponsoredAddress) => sponsoredAddress.targetAddress === targetAddress
    )
    return sponsoredAddress ? true : false
  }

  public async _estimateTransactionGas(
    safeTxData: SafeTransactionDataPartial
  ): Promise<{
    safeTxGas: BigNumber
    baseGas: number
    gasPrice: BigNumber
  }> {
    const safeTxGas = await this.getOwnerProvider().estimateGas({
      from: this.getAddress(),
      to: safeTxData.to,
      value: safeTxData.value,
      data: safeTxData.data
    })

    const ethFeeHistory = await this.getOwnerProvider().send('eth_feeHistory', [
      1,
      'latest',
      [this.REWARD_PERCENTILE]
    ])
    const [reward, BaseFee] = [
      BigNumber.from(ethFeeHistory.reward[0][0]),
      BigNumber.from(ethFeeHistory.baseFeePerGas[0])
    ]

    return {
      safeTxGas,
      baseGas: this.BASE_GAS,
      gasPrice: reward.add(BaseFee)
    }
  }

  public async sendTransaction(
    safeTxData: MetaTransactionData
  ): Promise<SendTransactionResponse> {
    const nonce = await this._getNonce()

    const safeTxDataTyped = {
      to: safeTxData.to,
      value: safeTxData.value ?? 0,
      data: safeTxData.data,
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce
    }

    if (!this._toSponsoredAddress(safeTxDataTyped.to)) {
      const { safeTxGas, baseGas, gasPrice } =
        await this._estimateTransactionGas(safeTxDataTyped)

      safeTxDataTyped.safeTxGas = +safeTxGas
      safeTxDataTyped.baseGas = baseGas
      safeTxDataTyped.gasPrice = +gasPrice
    }

    const signature = await this._signTransaction(safeTxDataTyped, nonce)

    const safeTxHash = await this.API.relayTransaction({
      safeTxData: safeTxDataTyped,
      signatures: signature,
      walletAddress: this.getAddress()
    })

    return { safeTxHash }
  }

  public async getSuccessExecTransactionEvent(
    safeTxHash: string
  ): Promise<any> {
    const safeInstance = await Safe__factory.connect(
      this.getAddress(),
      this.getOwnerProvider()
    )

    const transactionEvents = await safeInstance.queryFilter(
      safeInstance.filters.ExecutionSuccess(),
      BLOCK_EVENT_GAP
    )
    const filteredTransactionEvent = transactionEvents.filter(
      (e) => e.args.txHash === safeTxHash
    )

    return filteredTransactionEvent[0]
  }

  public async getFailedExecTransactionEvent(safeTxHash: string): Promise<any> {
    const safeInstance = await Safe__factory.connect(
      this.getAddress(),
      this.getOwnerProvider()
    )

    const transactionEvents = await safeInstance.queryFilter(
      safeInstance.filters.ExecutionFailure(),
      BLOCK_EVENT_GAP
    )
    const filteredTransactionEvent = transactionEvents.filter(
      (e) => e.args.txHash === safeTxHash
    )

    return filteredTransactionEvent[0]
  }

  /**
   * WebAutn Section
   */

  public async addWebAuthnOwner(): Promise<any> {
    const signer = this.eoaAdapter.getEthProvider()?.getSigner()
    if (!signer) throw new Error('No signer found')

    const webAuthnCredentials = await webAutn.addOwner(this.getAddress())

    const x = `0x${webAuthnCredentials.point.getX().toString(16)}`
    const y = `0x${webAuthnCredentials.point.getY().toString(16)}`
    const publicKeyId = webAuthnCredentials.id

    const message = `${x},${y},${publicKeyId}`
    const signature = await this.signMessage(
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message))
    )

    await this.API.addWebAuthnOwner(
      this.getAddress(),
      publicKeyId,
      x,
      y,
      signature,
      message,
      undefined
    )

    const signerAddress = await this.getWebAuthnSigner(x, y)

    await this.API.addWebAuthnOwner(
      this.getAddress(),
      publicKeyId,
      x,
      y,
      signature,
      message,
      signerAddress
    )

    await this.addOwner(signerAddress)
  }

  private async getWebAuthnSigner(x: string, y: string): Promise<string> {
    const P256FactoryInstance = await P256SignerFactory__factory.connect(
      this.P256FactoryContractAddress,
      this.getOwnerProvider()
    )

    let signerDeploymentEvent: any = []

    while (signerDeploymentEvent.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      signerDeploymentEvent = await P256FactoryInstance.queryFilter(
        P256FactoryInstance.filters.NewSignerCreated(x, y),
        BLOCK_EVENT_GAP
      )
    }

    return signerDeploymentEvent[0].args.signer
  }
}
