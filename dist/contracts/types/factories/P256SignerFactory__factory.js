"use strict";
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.P256SignerFactory__factory = void 0;
const ethers_1 = require("ethers");
const _abi = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: 'uint256',
                name: 'x',
                type: 'uint256'
            },
            {
                indexed: true,
                internalType: 'uint256',
                name: 'y',
                type: 'uint256'
            },
            {
                indexed: false,
                internalType: 'address',
                name: 'signer',
                type: 'address'
            }
        ],
        name: 'NewSignerCreated',
        type: 'event'
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256'
            },
            {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256'
            }
        ],
        name: 'create',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [
            {
                internalType: 'uint256',
                name: 'x',
                type: 'uint256'
            },
            {
                internalType: 'uint256',
                name: 'y',
                type: 'uint256'
            }
        ],
        name: 'getAddressFor',
        outputs: [
            {
                internalType: 'address',
                name: 'signer',
                type: 'address'
            }
        ],
        stateMutability: 'view',
        type: 'function'
    }
];
class P256SignerFactory__factory {
    static createInterface() {
        return new ethers_1.utils.Interface(_abi);
    }
    static connect(address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    }
}
exports.P256SignerFactory__factory = P256SignerFactory__factory;
P256SignerFactory__factory.abi = _abi;
