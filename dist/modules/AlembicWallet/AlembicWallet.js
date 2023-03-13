"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlembicWallet = void 0;
const siwe_1 = require("siwe");
const adapters_1 = require("../../adapters");
const API_1 = require("../../services/API/API");
const SmartWallet_1 = require("../SmartWallet");
class AlembicWallet {
    constructor(eoaAdapter = adapters_1.Web3AuthAdapter, chainId = adapters_1.DEFAULT_CHAIN_ID, rpcTarget = adapters_1.DEFAULT_RPC_TARGET) {
        this.isConnected = false;
        this.smartWalletAddress = null;
        this.ethProvider = null;
        this.smartWallet = null;
        this.ownerAddress = null;
        this.chainId = chainId;
        this.rpcTarget = rpcTarget;
        this.eoaAdapter = new eoaAdapter();
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            // Return if does not match requirements
            if (!this.eoaAdapter)
                throw new Error('No EOA adapter found');
            if (!this.chainId)
                throw new Error('No chainId set');
            if (!this.rpcTarget)
                throw new Error('No rpcUrl set');
            // Initialize EOA adapter
            yield this.eoaAdapter.init(this.chainId, this.rpcTarget);
            yield this.eoaAdapter.connect();
            // We get the owner address
            const ownerAddress = yield this.eoaAdapter.getAccount();
            if (!ownerAddress)
                throw new Error('No account found');
            this.ownerAddress = ownerAddress;
            // We get the user nonce by calling AlembicAPI
            const nonce = yield API_1.API.getNonce(ownerAddress);
            if (!nonce)
                throw new Error('No nonce found');
            // We prepare and sign a message, using siwe, in order to prove the user identity
            const message = this.createMessage(ownerAddress, nonce);
            const signature = yield this.signMessage(message);
            if (!signature)
                throw new Error('No signature found');
            const smartWalletAddress = yield API_1.API.connectToAlembicWallet({
                message,
                signature,
                ownerAddress: ownerAddress
            });
            if (!smartWalletAddress)
                throw new Error('Failed to connect to Alembic');
            // We set the connection status to true and store the ethProvider
            if (smartWalletAddress) {
                this.smartWalletAddress = smartWalletAddress;
                this.ethProvider = this.eoaAdapter.getEthProvider();
            }
            // We initialize the smart wallet
            if (this.ethProvider && this.smartWalletAddress) {
                const smartWallet = new SmartWallet_1.SmartWallet({
                    smartWalletAddress: this.smartWalletAddress,
                    ethProvider: this.ethProvider
                });
                yield smartWallet.init();
                this.smartWallet = smartWallet;
            }
        });
    }
    getIsConnected() {
        return this.isConnected;
    }
    logout() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.eoaAdapter)
                throw new Error('No EOA adapter found');
            yield this.eoaAdapter.logout();
            this.isConnected = false;
        });
    }
    createMessage(address, nonce, statement = `Sign in with Ethereum to Alembic`) {
        const domain = window.location.host;
        const origin = window.location.origin;
        const message = new siwe_1.SiweMessage({
            domain,
            address,
            statement,
            uri: origin,
            version: '1',
            chainId: this.chainId,
            nonce: nonce === null || nonce === void 0 ? void 0 : nonce.connectionNonce
        });
        return message;
    }
    sendTransaction(safeTxData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.smartWallet)
                throw new Error('No smart wallet found');
            const relayId = yield this.smartWallet.sendTransaction(safeTxData);
            return relayId;
        });
    }
    getRelayTxStatus(relayId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.smartWallet)
                throw new Error('No smart wallet found');
            return yield API_1.API.getRelayTxStatus(relayId);
        });
    }
    getUserInfos() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.eoaAdapter || !this.ownerAddress || !this.smartWalletAddress)
                throw new Error('Cannot provide user infos');
            const userInfos = yield this.eoaAdapter.getUserInfos();
            return Object.assign(Object.assign({}, userInfos), { ownerAddress: this.ownerAddress, smartWalletAddress: this.smartWalletAddress });
        });
    }
    getOwnerAddress() {
        return this.ownerAddress;
    }
    getSmartWalletAddress() {
        return this.smartWalletAddress;
    }
    signMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.eoaAdapter)
                throw new Error('No EOA adapter found');
            const messageToSign = message.prepareMessage();
            const signer = this.eoaAdapter.getSigner();
            const signature = yield (signer === null || signer === void 0 ? void 0 : signer.signMessage(messageToSign));
            return signature;
        });
    }
}
exports.AlembicWallet = AlembicWallet;
