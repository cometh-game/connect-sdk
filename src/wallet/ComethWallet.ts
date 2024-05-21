import { JsonRpcSigner, StaticJsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, Bytes, constants, Wallet } from 'ethers'
import { formatUnits, hashMessage } from 'ethers/lib/utils'
import { encodeMulti, MetaTransaction } from 'ethers-multisend'

import {
  DEFAULT_BASE_GAS_LOCAL_WALLET,
  DEFAULT_BASE_GAS_WEBAUTHN,
  DEFAULT_REWARD_PERCENTILE,
  EIP712_SAFE_MESSAGE_TYPE,
  EIP712_SAFE_TX_TYPES,
  networks,
  supportedTokens
} from '../constants'
import { API } from '../services'
import delayModuleService from '../services/delayModuleService'
import deploymentManagerService from '../services/deploymentManagerService'
import gasService from '../services/gasService'
import safeService from '../services/safeService'
import simulateTxService from '../services/simulateTxService'
import sponsoredService from '../services/sponsoredService'
import { GasModal } from '../ui'
import { isMetaTransactionArray } from '../utils/utils'
import { AUTHAdapter } from './adapters'
import {
  CancelRecoveryError,
  EmptyBatchTransactionError,
  GetRecoveryError,
  NetworkNotSupportedError,
  NewRecoveryNotSupportedError,
  NoAdapterFoundError,
  NoRecoveryRequestFoundError,
  NoSignerFoundError,
  ProjectParamsError,
  ProvidedNetworkDifferentThanProjectNetwork,
  RecoveryAlreadySetUp,
  TransactionDeniedError,
  WalletNotConnectedError
} from './errors'
import { WebAuthnSigner } from './signers/WebAuthnSigner'
import {
  EnrichedOwner,
  MetaTransactionData,
  ProjectParams,
  RecoveryRequest,
  RelayedTransaction,
  RelayedTransactionDetails,
  SafeTransactionDataPartial,
  SendTransactionResponse,
  SponsoredTransaction,
  UIConfig,
  WalletInfos
} from './types'

export interface WalletConfig {
  authAdapter: AUTHAdapter
  apiKey: string
  rpcUrl?: string
  uiConfig?: UIConfig
  baseUrl?: string
  transactionTimeout?: number
  gasToken?: string
}

export class ComethWallet {
  public authAdapter: AUTHAdapter
  readonly chainId: number
  private connected = false
  private BASE_GAS: number
  private REWARD_PERCENTILE: number
  private API: API
  private provider: StaticJsonRpcProvider
  private sponsoredAddresses?: SponsoredTransaction[]
  private walletAddress?: string
  public signer?: JsonRpcSigner | Wallet | WebAuthnSigner
  public transactionTimeout?: number
  private projectParams?: ProjectParams
  private walletInfos?: WalletInfos
  private uiConfig: UIConfig
  private gasToken?: string

  constructor({
    authAdapter,
    apiKey,
    rpcUrl,
    baseUrl,
    uiConfig = {
      displayValidationModal: true
    },
    transactionTimeout,
    gasToken
  }: WalletConfig) {
    this.authAdapter = authAdapter
    this.chainId = +authAdapter.chainId
    this.API = new API(apiKey, baseUrl)
    this.provider = new StaticJsonRpcProvider(
      rpcUrl ? rpcUrl : networks[this.chainId].RPCUrl
    )
    this.BASE_GAS = DEFAULT_BASE_GAS_WEBAUTHN
    this.REWARD_PERCENTILE = DEFAULT_REWARD_PERCENTILE
    this.uiConfig = uiConfig
    this.transactionTimeout = transactionTimeout
    this.gasToken = gasToken
  }

  /**
   * Connection Section
   */

  public async connect(walletAddress?: string): Promise<void> {
    if (!networks[this.chainId]) throw new NetworkNotSupportedError()

    if (!this.authAdapter) throw new NoAdapterFoundError()
    await this.authAdapter.connect(walletAddress)

    this.projectParams = await this.API.getProjectParams()
    if (this.chainId !== +this.projectParams.chainId)
      throw new ProvidedNetworkDifferentThanProjectNetwork()

    this.signer = this.authAdapter.getSigner()
    this.walletAddress = this.authAdapter.getWalletAddress()

    if (!this.signer) throw new NoSignerFoundError()
    if (!this.walletAddress) throw new WalletNotConnectedError()

    if (this.signer instanceof Wallet)
      this.BASE_GAS = DEFAULT_BASE_GAS_LOCAL_WALLET

    this.sponsoredAddresses = await this.API.getSponsoredAddresses()
    this.walletInfos = await this.API.getWalletInfos(this.walletAddress)
    this.connected = true
  }

  public getSponsoredAddresses(): SponsoredTransaction[] | undefined {
    return this.sponsoredAddresses
  }

  public getConnected(): boolean {
    return this.connected
  }

  public getProvider(): StaticJsonRpcProvider {
    return this.provider
  }

  public async getWalletInfos(): Promise<WalletInfos> {
    return await this.API.getWalletInfos(this.getAddress())
  }

  public getAddress(): string {
    return this.walletAddress ?? ''
  }

  public async logout(): Promise<void> {
    if (this.authAdapter) await this.authAdapter.logout()

    this.connected = false
  }

  public async addOwner(newOwner: string): Promise<SendTransactionResponse> {
    const tx = await safeService.prepareAddOwnerTx(
      this.getAddress(),
      newOwner,
      this.provider
    )

    return await this.sendTransaction(tx)
  }

  public async removeOwner(owner: string): Promise<SendTransactionResponse> {
    const tx = await safeService.prepareRemoveOwnerTx(
      this.getAddress(),
      owner,
      this.provider
    )

    const localStorageSigner = window.localStorage.getItem(
      `cometh-connect-${this.getAddress()}`
    )

    if (
      localStorageSigner &&
      JSON.parse(localStorageSigner).signerAddress === owner
    )
      window.localStorage.removeItem(`cometh-connect-${this.getAddress()}`)

    return await this.sendTransaction(tx)
  }

  public async getOwners(): Promise<string[]> {
    if (!this.walletInfos) throw new WalletNotConnectedError()

    const isWalletDeployed = await safeService.isDeployed(
      this.walletInfos.address,
      this.provider
    )

    const owners = isWalletDeployed
      ? await safeService.getOwners(this.walletInfos.address, this.provider)
      : [this.walletInfos.initiatorAddress]

    return owners
  }

  public async getEnrichedOwners(): Promise<EnrichedOwner[]> {
    if (!this.walletInfos) throw new WalletNotConnectedError()

    const owners = await this.getOwners()

    const webAuthnSigners = await this.API.getWebAuthnSignersByWalletAddress(
      this.walletInfos.address
    )

    const enrichedOwners = owners.map((owner) => {
      const webauthSigner = webAuthnSigners.find(
        (webauthnSigner) => webauthnSigner.signerAddress === owner
      )

      if (webauthSigner) {
        return {
          address: owner,
          deviceData: webauthSigner.deviceData,
          creationDate: webauthSigner.creationDate
        }
      } else {
        return { address: owner }
      }
    })

    return enrichedOwners
  }

  /**
   * Signing Message Section
   */

  public async signMessage(messageToSign: string | Bytes): Promise<string> {
    if (typeof messageToSign === 'string') {
      messageToSign = hashMessage(messageToSign)
    }

    if (!this.signer) throw new NoSignerFoundError()

    return await this.signer._signTypedData(
      {
        chainId: this.chainId,
        verifyingContract: this.getAddress()
      },
      EIP712_SAFE_MESSAGE_TYPE,
      { message: messageToSign }
    )
  }

  async signTransaction(
    safeTxData: SafeTransactionDataPartial
  ): Promise<string> {
    if (!this.signer) throw new NoSignerFoundError()

    return await this.signer._signTypedData(
      {
        chainId: this.chainId,
        verifyingContract: this.getAddress()
      },
      EIP712_SAFE_TX_TYPES,
      {
        to: safeTxData.to,
        value: BigNumber.from(safeTxData.value).toString(),
        data: safeTxData.data,
        operation: safeTxData.operation,
        safeTxGas: BigNumber.from(safeTxData.safeTxGas).toString(),
        baseGas: BigNumber.from(safeTxData.baseGas).toString(),
        gasPrice: BigNumber.from(safeTxData.gasPrice).toString(),
        gasToken: constants.AddressZero,
        refundReceiver: constants.AddressZero,
        nonce: BigNumber.from(
          safeTxData.nonce
            ? safeTxData.nonce
            : await safeService.getNonce(this.getAddress(), this.getProvider())
        ).toString()
      }
    )
  }

  private async _isSponsoredTransaction(
    safeTransactionData: MetaTransactionData[]
  ): Promise<boolean> {
    if (!this.walletInfos) throw new WalletNotConnectedError()

    for (let i = 0; i < safeTransactionData.length; i++) {
      const functionSelector = safeService.getFunctionSelector(
        safeTransactionData[i]
      )

      const isSponsored = await sponsoredService.isSponsoredAddress(
        functionSelector,
        this.walletInfos.address,
        safeTransactionData[i].to,
        this.sponsoredAddresses,
        this.walletInfos.proxyDelayAddress,
        this.walletInfos.recoveryContext?.moduleFactoryAddress
      )

      if (!isSponsored) return false
    }
    return true
  }

  public async _signAndSendTransaction(
    safeTxDataTyped: SafeTransactionDataPartial
  ): Promise<RelayedTransaction> {
    const txSignature = await this.signTransaction(safeTxDataTyped)

    return await this.API.relayTransaction({
      safeTxData: safeTxDataTyped,
      signatures: txSignature,
      walletAddress: this.getAddress()
    })
  }

  public async sendTransaction(
    safeTxData: MetaTransaction
  ): Promise<SendTransactionResponse> {
    const safeTxDataTyped = await this.buildTransaction(safeTxData)

    return await this._signAndSendTransaction(safeTxDataTyped)
  }

  public async sendBatchTransactions(
    safeTxData: MetaTransaction[]
  ): Promise<SendTransactionResponse> {
    if (safeTxData.length === 0) {
      throw new EmptyBatchTransactionError()
    }
    const safeTxDataTyped = await this.buildTransaction(safeTxData)
    return await this._signAndSendTransaction(safeTxDataTyped)
  }

  public async getRelayedTransaction(
    relayId: string
  ): Promise<RelayedTransactionDetails> {
    return await this.API.getRelayedTransaction(relayId)
  }

  public async displayModal(
    totalGasCost: BigNumber,
    txValue: BigNumber
  ): Promise<void> {
    let walletBalance: BigNumber
    let currency: string

    if (this.gasToken) {
      walletBalance = await gasService.getBalanceForToken(
        this.getAddress(),
        this.gasToken,
        this.provider
      )
      currency = supportedTokens[this.gasToken] || 'Units'
    } else {
      walletBalance = await this.provider.getBalance(this.getAddress())
      currency = networks[this.chainId].currency
    }

    const totalCost = totalGasCost.add(txValue)

    const displayedTotalBalance = formatUnits(walletBalance, 18)
    const displayedTotalCost = formatUnits(totalCost, 18)

    if (
      !(await new GasModal().initModal(
        displayedTotalBalance,
        displayedTotalCost,
        currency
      ))
    ) {
      throw new TransactionDeniedError()
    }
  }

  public async _formatTransaction(
    to: string,
    value: string,
    data: string,
    operation?: number
  ): Promise<SafeTransactionDataPartial> {
    return {
      to: to,
      value: value ?? '0',
      data: data,
      operation: operation ?? 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: constants.AddressZero,
      refundReceiver: constants.AddressZero,
      nonce: await safeService.getNonce(this.getAddress(), this.getProvider())
    }
  }

  public async estimateTxGasAndValue(
    safeTxData: MetaTransaction | MetaTransaction[]
  ): Promise<{
    safeTxGas: BigNumber
    gasPrice: BigNumber
    totalGasCost: BigNumber
    txValue: BigNumber
  }> {
    if (!this.projectParams) throw new ProjectParamsError()

    const safeTxGas = await simulateTxService.estimateSafeTxGasWithSimulate(
      this.getAddress(),
      this.provider,
      safeTxData,
      this.projectParams.multisendContractAddress,
      this.projectParams.singletonAddress,
      this.projectParams.simulateTxAcessorAddress
    )

    let gasPrice: BigNumber

    if (this.gasToken) {
      gasPrice = await gasService.getGasPriceForToken(this.gasToken, this.API)
    } else {
      gasPrice = await gasService.getGasPrice(
        this.provider,
        this.REWARD_PERCENTILE
      )
    }

    const totalGasCost = await gasService.getTotalCost(
      safeTxGas,
      this.BASE_GAS,
      gasPrice
    )

    const txValue = BigNumber.from(
      isMetaTransactionArray(safeTxData)
        ? await safeService.getTransactionsTotalValue(safeTxData)
        : safeTxData.value
    )

    return {
      safeTxGas,
      gasPrice,
      totalGasCost,
      txValue
    }
  }

  public async verifyHasEnoughBalance(totalGasCost, txValue): Promise<void> {
    return await gasService.verifyHasEnoughBalance(
      this.provider,
      this.getAddress(),
      totalGasCost,
      txValue,
      this.gasToken
    )
  }

  public async buildTransaction(
    safeTxData: MetaTransaction | MetaTransaction[]
  ): Promise<SafeTransactionDataPartial> {
    if (!this.projectParams) throw new ProjectParamsError()

    let safeTxDataTyped
    let isSponsoredTransaction: boolean

    if (isMetaTransactionArray(safeTxData)) {
      isSponsoredTransaction = await this._isSponsoredTransaction(safeTxData)

      const multisendData = encodeMulti(
        safeTxData,
        this.projectParams.multisendContractAddress
      ).data

      safeTxDataTyped = {
        ...(await this._formatTransaction(
          this.projectParams.multisendContractAddress,
          '0',
          multisendData,
          1
        ))
      }
    } else {
      safeTxDataTyped = {
        ...(await this._formatTransaction(
          safeTxData.to,
          safeTxData.value,
          safeTxData.data
        ))
      }
      isSponsoredTransaction = await this._isSponsoredTransaction([
        safeTxDataTyped
      ])
    }

    if (!isSponsoredTransaction) {
      const { safeTxGas, gasPrice, totalGasCost, txValue } =
        await this.estimateTxGasAndValue(safeTxData)

      await this.verifyHasEnoughBalance(totalGasCost, txValue)

      if (this.uiConfig.displayValidationModal) {
        await this.displayModal(totalGasCost, txValue)
      }

      safeTxDataTyped.safeTxGas = +safeTxGas
      safeTxDataTyped.baseGas = this.BASE_GAS
      safeTxDataTyped.gasPrice = +gasPrice
      safeTxDataTyped.gasToken = this.gasToken
    }

    return safeTxDataTyped
  }

  async getRecoveryRequest(): Promise<RecoveryRequest | undefined> {
    if (!this.walletInfos) throw new WalletNotConnectedError()

    if (!this.walletInfos.proxyDelayAddress)
      throw new NewRecoveryNotSupportedError()

    try {
      const isRecoveryQueueEmpty = await delayModuleService.isQueueEmpty(
        this.walletInfos.proxyDelayAddress,
        this.provider
      )

      if (isRecoveryQueueEmpty) {
        return undefined
      } else {
        return await delayModuleService.getCurrentRecoveryParams(
          this.walletInfos.proxyDelayAddress,
          this.provider
        )
      }
    } catch {
      throw new GetRecoveryError()
    }
  }

  async cancelRecoveryRequest(): Promise<SendTransactionResponse> {
    if (!this.walletInfos) throw new WalletNotConnectedError()

    if (!this.walletInfos.proxyDelayAddress)
      throw new NewRecoveryNotSupportedError()

    const recoveryRequest = await this.getRecoveryRequest()
    if (!recoveryRequest) throw new NoRecoveryRequestFoundError()

    try {
      const tx = await delayModuleService.createSetTxNonceFunction(
        this.walletInfos.proxyDelayAddress,
        this.provider
      )

      return await this.sendTransaction(tx)
    } catch {
      throw new CancelRecoveryError()
    }
  }

  async setUpRecovery(): Promise<SendTransactionResponse> {
    if (!this.walletInfos || !this.walletInfos.recoveryContext)
      throw new WalletNotConnectedError()

    if (!this.projectParams) throw new ProjectParamsError()

    const walletAddress = this.walletInfos.address
    const { guardianId, deploymentManagerAddress } = this.projectParams

    const guardianAddress = await deploymentManagerService.getGuardian({
      guardianId,
      deploymentManagerAddress,
      provider: this.provider
    })

    const delayAddress = await delayModuleService.getDelayAddress(
      walletAddress,
      this.walletInfos.recoveryContext
    )

    this.walletInfos.proxyDelayAddress = delayAddress

    const isDeployed = await delayModuleService.isDeployed({
      delayAddress,
      provider: this.provider
    })

    if (isDeployed) throw new RecoveryAlreadySetUp()

    const {
      recoveryCooldown: cooldown,
      recoveryExpiration: expiration,
      moduleFactoryAddress,
      delayModuleAddress: singletonDelayModuleAddress
    } = this.walletInfos.recoveryContext

    const delayModuleInitializer = await delayModuleService.setUpDelayModule({
      safe: walletAddress,
      cooldown,
      expiration
    })

    const setUpRecoveryTx = [
      {
        to: moduleFactoryAddress,
        value: '0',
        data: await delayModuleService.encodeDeployDelayModule({
          singletonDelayModule: singletonDelayModuleAddress,
          initializer: delayModuleInitializer,
          safe: walletAddress
        })
      },
      {
        to: delayAddress,
        value: '0',
        data: await delayModuleService.encodeEnableModule(guardianAddress)
      },
      {
        to: walletAddress,
        value: '0',
        data: await safeService.encodeEnableModule(delayAddress)
      }
    ]

    return await this.sendBatchTransactions(setUpRecoveryTx)
  }
}
