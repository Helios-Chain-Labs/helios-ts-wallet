import { Wallet } from '@ethersproject/wallet'
import { createMessageSend } from '@tharsis/transactions'
import {
  broadcast,
  getSender,
  LOCALNET_CHAIN,
  LOCALNET_FEE,
  signTransaction,
  signTransactionUsingEIP712,
} from './signer'
// We are doing the test with broadcast block so it's going to take at least 6 seconds per transaction, that's why we need to change the timeout to something bigger
// The block flag is required so the account sequence is updated between tests

jest.setTimeout(60 * 60 * 10000)

// NOTE: this tests requires that the address has coins
describe('send transactions to the node', () => {
  it('simple send using EIP712', async () => {
    const privateMnemonic =
      'pluck view carry maid bamboo river major where dutch wood certain oval order wise awkward clerk adult summer because number raven coil crunch hat'
    const wallet = Wallet.fromMnemonic(privateMnemonic)
    const sender = await getSender(wallet)

    const txSimple = createMessageSend(
      LOCALNET_CHAIN,
      sender,
      LOCALNET_FEE,
      '',
      {
        destinationAddress: 'helios1pmk2r32ssqwps42y3c9d4clqlca403yd9wymgr',
        amount: '1',
        denom: 'ahelios',
      },
    )
    const resMM = await signTransactionUsingEIP712(
      wallet,
      sender.accountAddress,
      txSimple,
    )
    const broadcastRes = await broadcast(resMM)
    expect(broadcastRes.tx_response.code).toBe(0)
  })

  it('simple send using sign payload', async () => {
    const privateMnemonic =
      'pluck view carry maid bamboo river major where dutch wood certain oval order wise awkward clerk adult summer because number raven coil crunch hat'
    const wallet = Wallet.fromMnemonic(privateMnemonic)

    const sender = await getSender(wallet)
    const txSimple = createMessageSend(
      LOCALNET_CHAIN,
      sender,
      LOCALNET_FEE,
      '',
      {
        destinationAddress: 'helios1pmk2r32ssqwps42y3c9d4clqlca403yd9wymgr',
        amount: '1',
        denom: 'ahelios',
      },
    )

    const resKeplr = await signTransaction(wallet, txSimple)
    const broadcastRes = await broadcast(resKeplr)
    expect(broadcastRes.tx_response.code).toBe(0)
  })
})
