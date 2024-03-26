import { ethers } from 'ethers'
import { bigintToUint8Array, dataString, stringToUint8Array } from './bigint.js'
import { stripLeadingZeros } from './typed-arrays.js'
import { DistributiveOmit, assertNever } from './typescript.js'
import { EthereumSignedTransaction, EthereumUnsignedTransaction } from '../types/wire-types.js'

export interface IUnsignedTransactionLegacy {
	readonly type: 'legacy'
	readonly from: bigint
	readonly nonce: bigint
	readonly gasPrice: bigint
	readonly gasLimit: bigint
	readonly to: bigint | null
	readonly value: bigint
	readonly input: Uint8Array
	readonly chainId?: bigint
}

export interface IUnsignedTransaction2930 {
	readonly type: '2930'
	readonly from: bigint
	readonly chainId: bigint
	readonly nonce: bigint
	readonly gasPrice: bigint
	readonly gasLimit: bigint
	readonly to: bigint | null
	readonly value: bigint
	readonly input: Uint8Array
	readonly accessList: readonly {
		readonly address: bigint
		readonly storageKeys: readonly bigint[]
	}[]
}

export interface IUnsignedTransaction1559 {
	readonly type: '1559'
	readonly from: bigint
	readonly chainId: bigint
	readonly nonce: bigint
	readonly maxFeePerGas: bigint
	readonly maxPriorityFeePerGas: bigint
	readonly gasLimit: bigint
	readonly to: bigint | null
	readonly value: bigint
	readonly input: Uint8Array
	readonly accessList: readonly {
		readonly address: bigint
		readonly storageKeys: readonly bigint[]
	}[]
}

export interface IUnsignedTransaction4844 {
	readonly type: '4844'
	readonly from: bigint
	readonly chainId: bigint
	readonly nonce: bigint
	readonly maxFeePerGas: bigint
	readonly maxPriorityFeePerGas: bigint
	readonly gasLimit: bigint
	readonly to: bigint | null
	readonly value: bigint
	readonly input: Uint8Array
	readonly accessList: readonly {
		readonly address: bigint
		readonly storageKeys: readonly bigint[]
	}[]
	readonly maxFeePerBlobGas: bigint,
	readonly blobVersionedHashes: readonly bigint[]
}

export type ITransactionSignatureLegacy = {
	readonly r: bigint
	readonly s: bigint
	readonly hash: bigint
} & ({
	readonly v: bigint
} | {
	readonly yParity: 'even' | 'odd'
	readonly chainId: bigint
})

export type ITransactionSignature1559and2930and4844 = {
	readonly r: bigint
	readonly s: bigint
	readonly yParity: 'even' | 'odd'
	readonly hash: bigint
}

export type IUnsignedTransaction = IUnsignedTransactionLegacy | IUnsignedTransaction2930 | IUnsignedTransaction1559 | IUnsignedTransaction4844
export type ISignedTransaction1559 = IUnsignedTransaction1559 & ITransactionSignature1559and2930and4844
export type ISignedTransactionLegacy = IUnsignedTransactionLegacy & ITransactionSignatureLegacy
export type ISignedTransaction2930 = IUnsignedTransaction2930 & ITransactionSignature1559and2930and4844
export type ISignedTransaction4844 = IUnsignedTransaction4844 & ITransactionSignature1559and2930and4844
export type ISignedTransaction = ISignedTransaction1559 | ISignedTransactionLegacy | ISignedTransaction2930 | ISignedTransaction4844

export function calculateV(transaction: DistributiveOmit<ITransactionSignatureLegacy, 'hash'>): bigint {
	if ('v' in transaction) return transaction.v
	return (transaction.yParity === 'even' ? 0n : 1n) + 35n + 2n * transaction.chainId
}

type RlpEncodeableData = Uint8Array | Array<RlpEncodeableData>
function rlpEncode(data: RlpEncodeableData[]): Uint8Array {
	function rlpEncodeArray(data: RlpEncodeableData): ethers.RlpStructuredData {
		if (!Array.isArray(data)) return `0x${ dataString(data) }`
		return data.map((x) => Array.isArray(x) ? rlpEncodeArray(x) : `0x${ dataString(x) }`)
	}
	return stringToUint8Array(ethers.encodeRlp(data.map((x) => Array.isArray(x) ? rlpEncodeArray(x) : `0x${ dataString(x) }`)))
}

export function rlpEncodeSignedLegacyTransactionPayload(transaction: DistributiveOmit<ISignedTransactionLegacy, 'hash'>): Uint8Array {
	return rlpEncode([
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasPrice!, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		new Uint8Array(transaction.input),
		stripLeadingZeros(bigintToUint8Array(calculateV(transaction), 32)),
		(stripLeadingZeros(bigintToUint8Array(transaction.r, 32))),
		stripLeadingZeros(bigintToUint8Array(transaction.s, 32)),
	])
}

export function rlpEncodeSigned2930TransactionPayload(transaction: DistributiveOmit<ISignedTransaction2930, 'hash'>): Uint8Array {
	return rlpEncode([
		stripLeadingZeros(bigintToUint8Array(transaction.chainId, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasPrice, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		transaction.input,
		transaction.accessList.map(({address, storageKeys}) => [bigintToUint8Array(address, 20), storageKeys.map(slot => bigintToUint8Array(slot, 32))]),
		stripLeadingZeros(new Uint8Array([transaction.yParity === 'even' ? 0 : 1])),
		stripLeadingZeros(bigintToUint8Array(transaction.r, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.s, 32)),
	])
}

export function rlpEncodeSigned1559TransactionPayload(transaction: DistributiveOmit<ISignedTransaction1559, 'hash'>): Uint8Array {
	return rlpEncode([
		stripLeadingZeros(bigintToUint8Array(transaction.chainId, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxPriorityFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		transaction.input,
		transaction.accessList.map(({address, storageKeys}) => [bigintToUint8Array(address, 20), storageKeys.map(slot => bigintToUint8Array(slot, 32))]),
		stripLeadingZeros(new Uint8Array([transaction.yParity === 'even' ? 0 : 1])),
		stripLeadingZeros(bigintToUint8Array(transaction.r, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.s, 32)),
	])
}

export function rlpEncodeSigned4844TransactionPayload(transaction: DistributiveOmit<ISignedTransaction4844, 'hash'>): Uint8Array {
	return rlpEncode([
		stripLeadingZeros(bigintToUint8Array(transaction.chainId, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxPriorityFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		transaction.input,
		transaction.accessList.map(({address, storageKeys}) => [bigintToUint8Array(address, 20), storageKeys.map(slot => bigintToUint8Array(slot, 32))]),
		stripLeadingZeros(bigintToUint8Array(transaction.maxFeePerBlobGas, 32)),
		transaction.blobVersionedHashes.map((blobVersionedHash) => bigintToUint8Array(blobVersionedHash, 32)),
		stripLeadingZeros(new Uint8Array([transaction.yParity === 'even' ? 0 : 1])),
		stripLeadingZeros(bigintToUint8Array(transaction.r, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.s, 32)),
	])
}

export function rlpEncodeUnsignedLegacyTransactionPayload(transaction: IUnsignedTransactionLegacy): Uint8Array {
	const toEncode = [
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasPrice!, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		new Uint8Array(transaction.input),
	]
	if ('chainId' in transaction && transaction.chainId !== undefined) {
		toEncode.push(stripLeadingZeros(bigintToUint8Array(transaction.chainId, 32)))
		toEncode.push(stripLeadingZeros(new Uint8Array(0)))
		toEncode.push(stripLeadingZeros(new Uint8Array(0)))
	}
	return rlpEncode(toEncode)
}

export function rlpEncodeUnsigned2930TransactionPayload(transaction: IUnsignedTransaction2930 | ISignedTransaction2930): Uint8Array {
	return rlpEncode([
		stripLeadingZeros(bigintToUint8Array(transaction.chainId, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasPrice, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		transaction.input,
		transaction.accessList.map(({address, storageKeys}) => [bigintToUint8Array(address, 20), storageKeys.map(slot => bigintToUint8Array(slot, 32))]),
	])
}

export function rlpEncodeUnsigned1559TransactionPayload(transaction: IUnsignedTransaction1559): Uint8Array {
	const toEncode = [
		stripLeadingZeros(bigintToUint8Array(transaction.chainId, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxPriorityFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		transaction.input,
		transaction.accessList.map(({address, storageKeys}) => [bigintToUint8Array(address, 20), storageKeys.map(slot => bigintToUint8Array(slot, 32))]),
	]
	return rlpEncode(toEncode)
}

export function rlpEncodeUnsigned4844TransactionPayload(transaction: IUnsignedTransaction4844): Uint8Array {
	const toEncode = [
		stripLeadingZeros(bigintToUint8Array(transaction.chainId, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.nonce, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxPriorityFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.maxFeePerGas, 32)),
		stripLeadingZeros(bigintToUint8Array(transaction.gasLimit, 32)),
		transaction.to !== null ? bigintToUint8Array(transaction.to, 20) : new Uint8Array(0),
		stripLeadingZeros(bigintToUint8Array(transaction.value, 32)),
		transaction.input,
		transaction.accessList.map(({ address, storageKeys }) => [bigintToUint8Array(address, 20), storageKeys.map(slot => bigintToUint8Array(slot, 32))]),
		stripLeadingZeros(bigintToUint8Array(transaction.maxFeePerBlobGas, 32)),
		transaction.blobVersionedHashes.map((blobVersionedHash) => bigintToUint8Array(blobVersionedHash, 32)),
	]
	return rlpEncode(toEncode)
}

export function serializeSignedTransactionToBytes(transaction: DistributiveOmit<ISignedTransaction, 'hash'>): Uint8Array {
	switch (transaction.type) {
		case 'legacy': return rlpEncodeSignedLegacyTransactionPayload(transaction)
		case '2930': return new Uint8Array([1, ...rlpEncodeSigned2930TransactionPayload(transaction)])
		case '1559': return new Uint8Array([2, ...rlpEncodeSigned1559TransactionPayload(transaction)])
		case '4844': return new Uint8Array([2, ...rlpEncodeSigned4844TransactionPayload(transaction)])
		default: assertNever(transaction)
	}
}

export function serializeUnsignedTransactionToBytes(transaction: IUnsignedTransaction): Uint8Array {
	switch (transaction.type) {
		case 'legacy': return rlpEncodeUnsignedLegacyTransactionPayload(transaction)
		case '2930': return new Uint8Array([1, ...rlpEncodeUnsigned2930TransactionPayload(transaction)])
		case '1559': return new Uint8Array([2, ...rlpEncodeUnsigned1559TransactionPayload(transaction)])
		case '4844': return new Uint8Array([1, ...rlpEncodeUnsigned4844TransactionPayload(transaction)])
		default: assertNever(transaction)
	}
}

export function serializeTransactionToString(transaction: ISignedTransaction) {
	return `0x${dataString(serializeSignedTransactionToBytes(transaction))}`
}

export type FormBundleTransaction = {
	from: bigint,
	to: bigint,
	value: bigint,
	input: Uint8Array,
	gasLimit: bigint,
	nonce: bigint
}

export function EthereumUnsignedTransactionToUnsignedTransaction(transaction: EthereumUnsignedTransaction): IUnsignedTransaction {
	switch (transaction.type) {
		case '4844':
		case '2930':
		case '1559': {
			const { gas, ...other } = transaction
			return {
				...other,
				gasLimit: gas,
				accessList: transaction.accessList !== undefined ? transaction.accessList : []
			}
		}
		case 'legacy': {
			const { gas, ...other } = transaction
			return {
				...other,
				gasLimit: gas,
			}
		}
	}
}

export function EthereumSignedTransactionToSignedTransaction(transaction: EthereumSignedTransaction): ISignedTransaction {
	switch (transaction.type) {
		case '4844':
		case '2930':
		case '1559': return {
			...transaction,
			yParity: 'yParity' in transaction ? transaction.yParity : (transaction.v === 0n ? 'even' : 'odd'),
			gasLimit: transaction.gas,
			accessList: transaction.accessList !== undefined ? transaction.accessList : [],
		}
		case 'legacy': return {
			...transaction,
			gasLimit: transaction.gas,
		}
		default: assertNever(transaction)
	}
}

export function truncateAddr(address: string, charactersFromEachEnd = 7) {
	return `0x${address.substring(2, 2 + charactersFromEachEnd)}…${address.substring(address.length - charactersFromEachEnd, address.length)}`
}
