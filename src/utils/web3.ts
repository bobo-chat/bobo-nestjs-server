
import { ethers } from 'ethers'
import * as Crypto from 'crypto'

ethers.randomBytes.register((length) => {
  return new Uint8Array(Crypto.randomBytes(length))
})
ethers.computeHmac.register((algo, key, data) => {
  return Crypto.createHmac(algo, key).update(data).digest()
})

ethers.pbkdf2.register((passwd, salt, iter, keylen, algo) => {
  return Crypto.pbkdf2Sync(passwd, salt, iter, keylen, algo)
})

ethers.sha256.register((data) => {
  return Crypto.createHash('sha256').update(data).digest()
})

ethers.sha512.register((data) => {
  return Crypto.createHash('sha512').update(data).digest()
})

export const builWallet = (privateKey: string): ethers.Wallet => {
  return new ethers.Wallet(privateKey)
}
export const generatePrivateKey = (): string => {
  return ethers.Wallet.createRandom().privateKey
}

export const recoverAddress = (data: string, sign: string): string => {
  return ethers.recoverAddress(data, sign).toLowerCase()
}