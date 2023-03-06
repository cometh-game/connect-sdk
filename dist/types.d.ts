export type UserNonceType = {
    userAddress: OwnerAddress;
    connectionNonce: string;
};
export type OwnerAddress = `0x${string}`;
export type WalletAddress = string;
