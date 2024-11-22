import fetch from 'node-fetch'
import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util'
import { Wallet } from '@ethersproject/wallet'
import {
  arrayify,
  concat,
  splitSignature,
  joinSignature,
} from '@ethersproject/bytes'
import { createTxRaw } from '@tharsis/proto'
import {
  createTxRawEIP712,
  signatureToWeb3Extension,
  Sender,
  TxGenerated,
  Chain,
} from '@tharsis/transactions'
import { signatureToPubkey } from '@hanchon/signature-to-pubkey'
import { ethToHelios } from '@tharsis/address-converter'

// Chain helpers

export const LOCALNET_CHAIN = {
  chainId: 4242,
  cosmosChainId: 'helios_4242-1',
}

export const LOCALNET_FEE = {
  amount: '20',
  denom: 'ahelios',
  gas: '200000',
}

export const MAINNET_CHAIN = {
  chainId: 9001,
  cosmosChainId: 'helios_9001-2',
}

export const MAINNET_FEE = {
  amount: '3000000000000000',
  denom: 'ahelios',
  gas: '150000',
}

export const TESTNET_CHAIN = {
  chainId: 9000,
  cosmosChainId: 'helios_9000-4',
}

export const TESTNET_FEE = {
  amount: '5000',
  denom: 'athelios',
  gas: '600000',
}

// Get Account
/* eslint-disable camelcase */
interface AccountResponse {
  account: {
    '@type': string
    base_account: {
      address: string
      pub_key?: {
        '@type': string
        key: string
      }
      account_number: string
      sequence: string
    }
    code_hash: string
  }
}

export async function generatePubkey(wallet: Wallet) {
  // Sign the personal message `generate_pubkey` and generate the pubkey from that signature
  const signature = await wallet.signMessage('generate_pubkey')
  return signatureToPubkey(
    signature,
    Buffer.from([
      50, 215, 18, 245, 169, 63, 252, 16, 225, 169, 71, 95, 254, 165, 146, 216,
      40, 162, 115, 78, 147, 125, 80, 182, 25, 69, 136, 250, 65, 200, 94, 178,
    ]),
  )
}

export async function getSender(
  wallet: Wallet,
  url: string = 'http://127.0.0.1:1317',
) {
  const heliosAddress = ethToHelios(wallet.address)
  const addrRequest = await fetch(
    `${url}/cosmos/auth/v1beta1/accounts/${heliosAddress}`,
  )
  const resp = (await addrRequest.json()) as AccountResponse

  const sender = {
    accountAddress: heliosAddress,
    sequence: parseInt(resp.account.base_account.sequence as string, 10),
    accountNumber: parseInt(resp.account.base_account.account_number, 10),
    pubkey:
      resp.account.base_account.pub_key?.key || (await generatePubkey(wallet)),
  }
  return sender
}

// Broadcast a transaction in json.stringify format
export async function broadcast(
  transactionBody: string,
  url: string = 'http://127.0.0.1:1317',
) {
  const post = await fetch(`${url}/cosmos/tx/v1beta1/txs`, {
    method: 'post',
    body: transactionBody,
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await post.json()
  return data
}

// Sign transaction using payload method (keplr style)
export async function signTransaction(
  wallet: Wallet,
  tx: TxGenerated,
  broadcastMode: string = 'BROADCAST_MODE_BLOCK',
) {
  const dataToSign = `0x${Buffer.from(
    tx.signDirect.signBytes,
    'base64',
  ).toString('hex')}`

  /* eslint-disable no-underscore-dangle */
  const signatureRaw = wallet._signingKey().signDigest(dataToSign)
  const splitedSignature = splitSignature(signatureRaw)
  const signature = arrayify(concat([splitedSignature.r, splitedSignature.s]))

  const signedTx = createTxRaw(
    tx.signDirect.body.serializeBinary(),
    tx.signDirect.authInfo.serializeBinary(),
    [signature],
  )
  const body = `{ "tx_bytes": [${signedTx.message
    .serializeBinary()
    .toString()}], "mode": "${broadcastMode}" }`

  return body
}

// Sign transaction using eip712 method (metamask style)
export async function signTransactionUsingEIP712(
  wallet: Wallet,
  sender: string,
  tx: TxGenerated,
  chain: Chain = LOCALNET_CHAIN,
  broadcastMode: string = 'BROADCAST_MODE_BLOCK',
) {
  const dataToSign = arrayify(
    TypedDataUtils.eip712Hash(tx.eipToSign as any, SignTypedDataVersion.V4),
  )
  /* eslint-disable no-underscore-dangle */
  const signatureRaw = wallet._signingKey().signDigest(dataToSign)
  const signature = joinSignature(signatureRaw)

  const extension = signatureToWeb3Extension(
    chain,
    { accountAddress: sender } as Sender,
    signature,
  )
  const signedTx = createTxRawEIP712(
    tx.legacyAmino.body,
    tx.legacyAmino.authInfo,
    extension,
  )

  return `{ "tx_bytes": [${signedTx.message
    .serializeBinary()
    .toString()}], "mode": "${broadcastMode}" }`
}
