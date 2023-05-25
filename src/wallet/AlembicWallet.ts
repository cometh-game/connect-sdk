import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, Bytes, ethers } from 'ethers'
import { SiweMessage } from 'siwe'

import {
  DEFAULT_BASE_GAS,
  DEFAULT_REWARD_PERCENTILE,
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
import { GasModal } from '../ui'
import { AUTHAdapter } from './adapters'
import SafeUtils from './SafeUtils'
import {
  MetaTransactionData,
  SafeTransactionDataPartial,
  SendTransactionResponse,
  SponsoredTransaction,
  UserInfos,
  WebAuthnOwner
} from './types'
import WebAuthnUtils from './WebAuthnUtils'

export interface AlembicWalletConfig {
  authAdapter: AUTHAdapter
  apiKey: string
  rpcUrl?: string
  uiConfig?: {
    displayValidationModal: boolean
  }
}
export class AlembicWallet {
  private authAdapter: AUTHAdapter
  readonly chainId: number
  private connected = false
  private BASE_GAS: number
  private REWARD_PERCENTILE: number
  private API: API
  private provider: StaticJsonRpcProvider
  private sponsoredAddresses?: SponsoredTransaction[]
  private walletAddress?: string
  private uiConfig = {
    displayValidationModal: true
  }

  // Contracts Interfaces
  readonly SafeInterface: SafeInterface = Safe__factory.createInterface()
  readonly P256FactoryInterface: P256SignerFactoryInterface =
    P256SignerFactory__factory.createInterface()

  constructor({ authAdapter, apiKey, rpcUrl }: AlembicWalletConfig) {
    this.authAdapter = authAdapter
    this.chainId = +authAdapter.chaindId
    this.API = new API(apiKey, this.chainId)
    this.provider = new ethers.providers.StaticJsonRpcProvider(
      rpcUrl ? rpcUrl : networks[this.chainId].RPCUrl
    )
    this.BASE_GAS = DEFAULT_BASE_GAS
    this.REWARD_PERCENTILE = DEFAULT_REWARD_PERCENTILE
  }

  /**
   * Connection Section
   */

  public async connect(): Promise<void> {
    if (!(await this._verifyWebAuthnOwner())) {
      if (!this.authAdapter) throw new Error('No EOA adapter found')
      if (!networks[this.chainId])
        throw new Error('This network is not supported')
      await this.authAdapter.init()
      await this.authAdapter.connect()

      const signer = this.authAdapter.getSigner()
      if (!signer) throw new Error('No signer found')

      const ownerAddress = await signer.getAddress()
      if (!ownerAddress) throw new Error('No ownerAddress found')

      const nonce = await this.API.getNonce(ownerAddress)

      const message: SiweMessage = this._createMessage(ownerAddress, nonce)
      const messageToSign = message.prepareMessage()
      const signature = await signer.signMessage(messageToSign)

      this.walletAddress = await this.API?.connectToAlembicWallet({
        message,
        signature,
        ownerAddress
      })
    } else {
      const currentWebAuthnOwner = await this.getCurrentWebAuthnOwner()
      if (currentWebAuthnOwner)
        this.walletAddress = currentWebAuthnOwner.walletAddress
    }

    this.sponsoredAddresses = await this.API.getSponsoredAddresses()
    this.connected = true
  }

  public getConnected(): boolean {
    return this.connected
  }

  public getProvider(): StaticJsonRpcProvider {
    return this.provider
  }

  public async getUserInfos(): Promise<Partial<UserInfos>> {
    try {
      const userInfos = await this.authAdapter.getUserInfos()
      return {
        ...userInfos,
        ownerAddress: await this.authAdapter.getSigner()?.getAddress(),
        walletAddress: this.getAddress()
      }
    } catch {
      return { walletAddress: this.getAddress() }
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

  private _getBalance = async (address: string): Promise<BigNumber> => {
    return this.getProvider().getBalance(address)
  }

  public async logout(): Promise<void> {
    if (this.authAdapter) await this.authAdapter.logout()

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

  public async signMessage(messageToSign: string | Bytes): Promise<string> {
    if (await this._verifyWebAuthnOwner()) {
      return this._signMessageWithWebAuthn(messageToSign)
    } else {
      return this._signMessageWithEOA(messageToSign)
    }
  }

  private async _signMessageWithEOA(
    messageToSign: string | Bytes
  ): Promise<string> {
    const signer = this.authAdapter.getSigner()
    if (!signer) throw new Error('Sign message: missing signer')

    return await signer._signTypedData(
      {
        chainId: this.chainId,
        verifyingContract: this.getAddress()
      },
      EIP712_SAFE_MESSAGE_TYPE,
      { message: messageToSign }
    )
  }

  /**
   * Transaction Section
   */

  public async signTransaction(
    safeTxData: SafeTransactionDataPartial
  ): Promise<string> {
    if (await this._verifyWebAuthnOwner()) {
      return this._signTransactionwithWebAuthn(safeTxData)
    } else {
      return this._signTransactionWithEOA(safeTxData)
    }
  }

  private _signTransactionWithEOA = async (
    safeTxData: SafeTransactionDataPartial
  ): Promise<string> => {
    const signer = this.authAdapter.getSigner()
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
        nonce: BigNumber.from(
          await SafeUtils.getNonce(this.getAddress(), this.getProvider())
        ).toString()
      }
    )
  }

  private _isSponsoredAddress(targetAddress: string): boolean {
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
    const safeTxGas = await this.getProvider().estimateGas({
      from: this.getAddress(),
      to: safeTxData.to,
      value: safeTxData.value,
      data: safeTxData.data
    })

    const ethFeeHistory = await this.getProvider().send('eth_feeHistory', [
      1,
      'latest',
      [this.REWARD_PERCENTILE]
    ])
    const [reward, BaseFee] = [
      BigNumber.from(ethFeeHistory.reward[0][0]),
      BigNumber.from(ethFeeHistory.baseFeePerGas[0])
    ]

    const gasPrice = BigNumber.from(reward.add(BaseFee)).add(
      BigNumber.from(reward.add(BaseFee)).div(10)
    )

    return {
      safeTxGas,
      baseGas: this.BASE_GAS,
      gasPrice: gasPrice
    }
  }

  private async _calculateAndShowMaxFee(
    txValue: string,
    safeTxGas: BigNumber,
    baseGas: number,
    gasPrice: BigNumber
  ): Promise<void> {
    const walletBalance = await this._getBalance(this.getAddress())
    const totalGasCost = BigNumber.from(safeTxGas)
      .add(BigNumber.from(baseGas))
      .mul(BigNumber.from(gasPrice))

    if (walletBalance.lt(totalGasCost.add(BigNumber.from(txValue))))
      throw new Error('Not enough balance to send this value and pay for gas')

    if (this.uiConfig.displayValidationModal) {
      const totalFees = ethers.utils.formatEther(
        ethers.utils.parseUnits(
          BigNumber.from(safeTxGas).add(baseGas).mul(gasPrice).toString(),
          'wei'
        )
      )

      if (!(await new GasModal().initModal((+totalFees).toFixed(3)))) {
        throw new Error('Transaction denied')
      }
    }
  }

  public async sendTransaction(
    safeTxData: MetaTransactionData
  ): Promise<SendTransactionResponse> {
    const safeTxDataTyped = {
      to: safeTxData.to,
      value: safeTxData.value ?? '0x0',
      data: safeTxData.data,
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero,
      nonce: await SafeUtils.getNonce(this.getAddress(), this.getProvider())
    }

    if (!this._isSponsoredAddress(safeTxDataTyped.to)) {
      const { safeTxGas, baseGas, gasPrice } =
        await this._estimateTransactionGas(safeTxDataTyped)

      safeTxDataTyped.safeTxGas = +safeTxGas // gwei
      safeTxDataTyped.baseGas = baseGas // gwei
      safeTxDataTyped.gasPrice = +gasPrice // wei

      await this._calculateAndShowMaxFee(
        safeTxDataTyped.value,
        safeTxGas,
        baseGas,
        gasPrice
      )
    }

    const txSignature = await this.signTransaction(
      safeTxDataTyped as SafeTransactionDataPartial
    )

    const safeTxHash = await this.API.relayTransaction({
      safeTxData: safeTxDataTyped,
      signatures: txSignature,
      walletAddress: this.getAddress()
    })

    return { safeTxHash }
  }

  /**
   * WebAuthn Section
   */

  public async getCurrentWebAuthnOwner(): Promise<WebAuthnOwner | undefined> {
    const publicKeyId = WebAuthnUtils.getCurrentPublicKeyId()

    if (publicKeyId === null) return undefined

    const currentWebAuthnOwner = await this.API.getWebAuthnOwnerByPublicKeyId(
      <string>publicKeyId
    )

    return currentWebAuthnOwner
  }

  public async addWebAuthnOwner(): Promise<string> {
    const getWebAuthnOwners = await this.API.getWebAuthnOwners(
      this.getAddress()
    )

    const signerName = `Alembic Wallet - ${getWebAuthnOwners.length + 1}`

    const webAuthnCredentials = await WebAuthnUtils.createCredentials(
      signerName
    )

    const publicKeyX = `0x${webAuthnCredentials.point.getX().toString(16)}`
    const publicKeyY = `0x${webAuthnCredentials.point.getY().toString(16)}`
    const publicKeyId = webAuthnCredentials.id

    const predictedSignerAddress = await WebAuthnUtils.predictSignerAddress(
      publicKeyX,
      publicKeyY,
      this.chainId
    )

    const addOwnerTxData = {
      to: this.getAddress(),
      value: '0x00',
      data: this.SafeInterface.encodeFunctionData('addOwnerWithThreshold', [
        predictedSignerAddress,
        1
      ]),
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.constants.AddressZero,
      refundReceiver: ethers.constants.AddressZero
    }

    const addOwnerTxSignature = await this.signTransaction(addOwnerTxData)

    const message = `${publicKeyX},${publicKeyY},${publicKeyId}`
    const signature = await this.signMessage(ethers.utils.hashMessage(message))

    await this.API.addWebAuthnOwner(
      this.getAddress(),
      signerName,
      publicKeyId,
      publicKeyX,
      publicKeyY,
      signature,
      message,
      JSON.stringify(addOwnerTxData),
      addOwnerTxSignature
    )

    await WebAuthnUtils.waitWebAuthnSignerDeployment(
      publicKeyX,
      publicKeyY,
      this.chainId,
      this.getProvider()
    )

    WebAuthnUtils.updateCurrentWebAuthnOwner(
      publicKeyId,
      publicKeyX,
      publicKeyY
    )

    return predictedSignerAddress
  }

  private async _verifyWebAuthnOwner(): Promise<boolean> {
    const currentWebAuthnOwner = await this.getCurrentWebAuthnOwner()

    if (!currentWebAuthnOwner) return false

    const safeInstance = await Safe__factory.connect(
      currentWebAuthnOwner.walletAddress,
      this.getProvider()
    )
    const isSafeOwner = await safeInstance.isOwner(
      currentWebAuthnOwner.signerAddress
    )
    if (!isSafeOwner) return false

    return true
  }

  private async _signTransactionwithWebAuthn(
    safeTxDataTyped: SafeTransactionDataPartial
  ): Promise<string> {
    const currentWebAuthnOwner = await this.getCurrentWebAuthnOwner()
    if (!currentWebAuthnOwner) throw new Error('No WebAuthn signer found')

    const safeTxHash = await SafeUtils.getSafeTransactionHash(
      this.getAddress(),
      {
        to: safeTxDataTyped.to,
        value: BigNumber.from(safeTxDataTyped.value).toString(),
        data: safeTxDataTyped.data,
        operation: BigNumber.from(safeTxDataTyped.operation).toString(),
        safeTxGas: BigNumber.from(safeTxDataTyped.safeTxGas).toString(),
        baseGas: BigNumber.from(safeTxDataTyped.baseGas).toString(),
        gasPrice: BigNumber.from(safeTxDataTyped.gasPrice).toString(),
        gasToken: ethers.constants.AddressZero,
        refundReceiver: ethers.constants.AddressZero,
        nonce: await SafeUtils.getNonce(this.getAddress(), this.getProvider())
      },
      this.chainId
    )

    const encodedWebAuthnSignature = await WebAuthnUtils.getWebAuthnSignature(
      safeTxHash,
      currentWebAuthnOwner.publicKeyId
    )

    return SafeUtils.formatWebAuthnSignatureForSafe(
      currentWebAuthnOwner.signerAddress,
      encodedWebAuthnSignature
    )
  }

  private async _signMessageWithWebAuthn(
    messageToSign: string | Bytes
  ): Promise<string> {
    const currentWebAuthnOwner = await this.getCurrentWebAuthnOwner()

    if (!currentWebAuthnOwner) throw new Error('No WebAuthn signer found')

    const encodedWebAuthnSignature = await WebAuthnUtils.getWebAuthnSignature(
      ethers.utils.keccak256(messageToSign),
      currentWebAuthnOwner.publicKeyId
    )

    return SafeUtils.formatWebAuthnSignatureForSafe(
      currentWebAuthnOwner.signerAddress,
      encodedWebAuthnSignature
    )
  }
}
