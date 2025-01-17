import { closePopupOrTabById, getPopupOrTabById, openPopupOrTab, tryFocusingTabOrWindow } from '../../components/ui-utils.js'
import { EthereumClientService } from '../../simulation/services/EthereumClientService.js'
import { appendSignedMessage, appendTransaction, getInputFieldFromDataOrInput, getSimulatedTransactionCount, simulateEstimateGas, simulatePersonalSign } from '../../simulation/services/SimulationModeEthereumClientService.js'
import { CANNOT_SIMULATE_OFF_LEGACY_BLOCK, ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS, METAMASK_ERROR_NOT_CONNECTED_TO_CHAIN, METAMASK_ERROR_USER_REJECTED_REQUEST } from '../../utils/constants.js'
import { TransactionConfirmation } from '../../types/interceptor-messages.js'
import { Semaphore } from '../../utils/semaphore.js'
import { WebsiteTabConnections } from '../../types/user-interface-types.js'
import { WebsiteCreatedEthereumUnsignedTransaction, WebsiteCreatedEthereumUnsignedTransactionOrFailed } from '../../types/visualizer-types.js'
import { SendRawTransactionParams, SendTransactionParams } from '../../types/JsonRpc-types.js'
import { refreshConfirmTransactionSimulation, updateSimulationState } from '../background.js'
import { getHtmlFile, sendPopupMessageToOpenWindows } from '../backgroundUtils.js'
import { appendPendingTransactionOrMessage, clearPendingTransactions, getPendingTransactionsAndMessages, getSimulationResults, removePendingTransactionOrMessage, updatePendingTransactionOrMessage } from '../storageVariables.js'
import { InterceptedRequest, UniqueRequestIdentifier, doesUniqueRequestIdentifiersMatch, getUniqueRequestIdentifierString } from '../../utils/requests.js'
import { replyToInterceptedRequest } from '../messageSending.js'
import { Simulator } from '../../simulation/simulator.js'
import { ethers, keccak256, toUtf8Bytes } from 'ethers'
import { dataStringWith0xStart, stringToUint8Array } from '../../utils/bigint.js'
import { EthereumAddress, EthereumBytes32, EthereumQuantity } from '../../types/wire-types.js'
import { PopupOrTabId, Website } from '../../types/websiteAccessTypes.js'
import { handleUnexpectedError, printError } from '../../utils/errors.js'
import { PendingTransactionOrSignableMessage } from '../../types/accessRequest.js'
import { SignMessageParams } from '../../types/jsonRpc-signing-types.js'
import { craftPersonalSignPopupMessage } from './personalSign.js'
import { getSettings } from '../settings.js'
import * as funtypes from 'funtypes'

const pendingConfirmationSemaphore = new Semaphore(1)

export async function updateConfirmTransactionView(ethereumClientService: EthereumClientService) {
	const visualizedSimulatorStatePromise = getSimulationResults()
	const settings = getSettings()
	const currentBlockNumberPromise = ethereumClientService.getBlockNumber()
	const pendingTransactionAndSignableMessages = await getPendingTransactionsAndMessages()
	if (pendingTransactionAndSignableMessages.length === 0) return false
	await sendPopupMessageToOpenWindows({ method: 'popup_update_confirm_transaction_dialog', data: {
		 pendingTransactionAndSignableMessages,
		 currentBlockNumber: await currentBlockNumberPromise,
		 visualizedSimulatorState: (await settings).simulationMode ? await visualizedSimulatorStatePromise : undefined,
	} })
	return true
}

export const isConfirmTransactionFocused = async () => {
	const pendingTransactions = await getPendingTransactionsAndMessages()
	if (pendingTransactions[0] === undefined) return false
	const popup = await getPopupOrTabById(pendingTransactions[0].popupOrTabId)
	if (popup === undefined) return false
	if (popup.type === 'popup') return popup.window.focused
	return popup.tab.active
}

const getPendingTransactionOrMessageByidentifier = async (uniqueRequestIdentifier: UniqueRequestIdentifier) => {
	return (await getPendingTransactionsAndMessages()).find((tx) => doesUniqueRequestIdentifiersMatch(tx.uniqueRequestIdentifier, uniqueRequestIdentifier))
}

export async function resolvePendingTransactionOrMessage(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, confirmation: TransactionConfirmation) {
	const pendingTransactionOrMessage = await getPendingTransactionOrMessageByidentifier(confirmation.data.uniqueRequestIdentifier)
	if (pendingTransactionOrMessage === undefined) throw new Error('Tried to resolve pending transaction that did not exist anymore')
	
	const reply = (message: { type: 'forwardToSigner' } | { type: 'result', error: { code: number, message: string } } | { type: 'result', result: unknown }) => {
		if (message.type === 'result' && !('error' in message)) {
			if (pendingTransactionOrMessage.originalRequestParameters.method === 'eth_sendRawTransaction' || pendingTransactionOrMessage.originalRequestParameters.method === 'eth_sendTransaction') {
				return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, ...message, result: EthereumBytes32.parse(message.result), uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
			}
			return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, ...message, result: funtypes.String.parse(message.result), uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
		}
		return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, ...message, uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
	}
	if (confirmation.data.action === 'accept' && pendingTransactionOrMessage.simulationMode === false) {
		await updatePendingTransactionOrMessage(confirmation.data.uniqueRequestIdentifier, async (transaction) => ({ ...transaction, approvalStatus: { status: 'WaitingForSigner' } }))
		await updateConfirmTransactionView(simulator.ethereum)
		return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, type: 'forwardToSigner', uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
	}
	await removePendingTransactionOrMessage(confirmation.data.uniqueRequestIdentifier)
	if ((await getPendingTransactionsAndMessages()).length === 0) await tryFocusingTabOrWindow({ type: 'tab', id: pendingTransactionOrMessage.uniqueRequestIdentifier.requestSocket.tabId })
	if (!(await updateConfirmTransactionView(simulator.ethereum))) await closePopupOrTabById(pendingTransactionOrMessage.popupOrTabId)
	
	if (confirmation.data.action === 'noResponse') return reply(formRejectMessage(undefined))
	if (pendingTransactionOrMessage === undefined || pendingTransactionOrMessage.transactionOrMessageCreationStatus !== 'Simulated') return reply(formRejectMessage(undefined))
	if (confirmation.data.action === 'reject') return reply(formRejectMessage(confirmation.data.errorString))
	if (!pendingTransactionOrMessage.simulationMode) {
		if (confirmation.data.action === 'signerIncluded') return reply({ type: 'result', result: confirmation.data.signerReply })
		return reply({ type: 'forwardToSigner' })
	}
	if (confirmation.data.action === 'signerIncluded') throw new Error('Signer included transaction that was in simulation')
	const newState = await updateSimulationState(simulator.ethereum, async (simulationState) => {
		if (pendingTransactionOrMessage.type !== 'Transaction') return await appendSignedMessage(simulator.ethereum, simulationState, pendingTransactionOrMessage.signedMessageTransaction)
		return await appendTransaction(simulator.ethereum, simulationState, pendingTransactionOrMessage.transactionToSimulate)
	}, pendingTransactionOrMessage.activeAddress, true)
	if (newState === undefined) return reply({ type: 'result', ...METAMASK_ERROR_NOT_CONNECTED_TO_CHAIN })

	if (pendingTransactionOrMessage.type === 'Transaction') {
		const simulatedTransaction = newState.simulatedTransactions.find((x) => x.transactionIdentifier === pendingTransactionOrMessage.transactionIdentifier)
		if (simulatedTransaction === undefined) return reply(formRejectMessage('Could not find submited transaction in the simulation'))
		return reply({ type: 'result', result: EthereumBytes32.serialize(simulatedTransaction.signedTransaction.hash) })
	}	
	const simulatedMessage = newState.signedMessages.find((x) => x.messageIdentifier === pendingTransactionOrMessage.signedMessageTransaction.messageIdentifier)
	if (simulatedMessage === undefined) return reply(formRejectMessage('Could not find submited message in the simulation'))
	return reply({ type: 'result', result: (await simulatePersonalSign(simulatedMessage.originalRequestParameters, simulatedMessage.fakeSignedFor)).signature })
}

export const onCloseWindowOrTab = async (popupOrTabs: PopupOrTabId, simulator: Simulator, websiteTabConnections: WebsiteTabConnections) => { // check if user has closed the window on their own, if so, reject all signatures
	const transactions = await getPendingTransactionsAndMessages()
	const [firstTransaction] = transactions
	if (firstTransaction?.popupOrTabId.id !== popupOrTabs.id) return
	await resolveAllPendingTransactionsAndMessageAsNoResponse(transactions, simulator, websiteTabConnections)
}

const resolveAllPendingTransactionsAndMessageAsNoResponse = async (transactions: readonly PendingTransactionOrSignableMessage[], simulator: Simulator, websiteTabConnections: WebsiteTabConnections) => {
	for (const transaction of transactions) {
		try {
			await resolvePendingTransactionOrMessage(simulator, websiteTabConnections, { method: 'popup_confirmDialog', data: { uniqueRequestIdentifier: transaction.uniqueRequestIdentifier, action: 'noResponse' } })
		} catch(e) {
			printError(e)
		}
	}
	await clearPendingTransactions()
}

const formRejectMessage = (errorString: undefined | string) => {
	return {
		type: 'result' as const,
		error: {
			code: METAMASK_ERROR_USER_REJECTED_REQUEST,
			message: errorString === undefined ? 'Interceptor Tx Signature: User denied transaction signature.' : `Interceptor Tx Signature: User denied reverting transaction: ${ errorString }.`
		}
	}
}

export const formSendRawTransaction = async(ethereumClientService: EthereumClientService, sendRawTransactionParams: SendRawTransactionParams, website: Website, created: Date, transactionIdentifier: EthereumQuantity): Promise<WebsiteCreatedEthereumUnsignedTransaction> => {	
	const ethersTransaction = ethers.Transaction.from(dataStringWith0xStart(sendRawTransactionParams.params[0]))
	const transactionDetails = {
		from: EthereumAddress.parse(ethersTransaction.from),
		input: stringToUint8Array(ethersTransaction.data),
		...ethersTransaction.gasLimit === null ? { gas: ethersTransaction.gasLimit } : {},
		value: ethersTransaction.value,
		...ethersTransaction.to === null ? {} : { to: EthereumAddress.parse(ethersTransaction.to) },
		...ethersTransaction.gasPrice === null ? {} : { gasPrice: ethersTransaction.gasPrice },
		...ethersTransaction.maxPriorityFeePerGas === null ? {} : { maxPriorityFeePerGas: ethersTransaction.maxPriorityFeePerGas },
		...ethersTransaction.maxFeePerGas === null ? {} : { maxFeePerGas: ethersTransaction.maxFeePerGas },
	}

	if (transactionDetails.maxFeePerGas === undefined) throw new Error('No support for non-1559 transactions')

	const transaction = {
		type: '1559' as const,
		from: transactionDetails.from,
		chainId: ethereumClientService.getChainId(),
		nonce: BigInt(ethersTransaction.nonce),
		maxFeePerGas: transactionDetails.maxFeePerGas,
		maxPriorityFeePerGas: transactionDetails.maxPriorityFeePerGas ? transactionDetails.maxPriorityFeePerGas : 0n,
		to: transactionDetails.to === undefined ? null : transactionDetails.to,
		value: transactionDetails.value ? transactionDetails.value : 0n,
		input: transactionDetails.input,
		accessList: [],
		gas: ethersTransaction.gasLimit,
	}
	return {
		transaction,
		website,
		created,
		originalRequestParameters: sendRawTransactionParams,
		transactionIdentifier,
		success: true,
	}
}

export const formEthSendTransaction = async(ethereumClientService: EthereumClientService, activeAddress: bigint | undefined, website: Website, sendTransactionParams: SendTransactionParams, created: Date, transactionIdentifier: EthereumQuantity, simulationMode = true): Promise<WebsiteCreatedEthereumUnsignedTransactionOrFailed> => {
	const simulationState = simulationMode ? (await getSimulationResults()).simulationState : undefined
	const parentBlockPromise = ethereumClientService.getBlock() // we are getting the real block here, as we are not interested in the current block where this is going to be included, but the parent
	const transactionDetails = sendTransactionParams.params[0]
	if (activeAddress === undefined) throw new Error('Access to active address is denied')
	const from = simulationMode && transactionDetails.from !== undefined ? transactionDetails.from : activeAddress
	const transactionCount = getSimulatedTransactionCount(ethereumClientService, simulationState, from)
	const parentBlock = await parentBlockPromise
	if (parentBlock.baseFeePerGas === undefined) throw new Error(CANNOT_SIMULATE_OFF_LEGACY_BLOCK)
	const transactionWithoutGas = {
		type: '1559' as const,
		from,
		chainId: ethereumClientService.getChainId(),
		nonce: await transactionCount,
		maxFeePerGas: transactionDetails.maxFeePerGas !== undefined && transactionDetails.maxFeePerGas !== null ? transactionDetails.maxFeePerGas : parentBlock.baseFeePerGas * 2n,
		maxPriorityFeePerGas: transactionDetails.maxPriorityFeePerGas !== undefined && transactionDetails.maxPriorityFeePerGas !== null ? transactionDetails.maxPriorityFeePerGas : 10n**8n, // 0.1 nanoEth/gas
		to: transactionDetails.to === undefined ? null : transactionDetails.to,
		value: transactionDetails.value !== undefined  ? transactionDetails.value : 0n,
		input: getInputFieldFromDataOrInput(transactionDetails),
		accessList: [],
	}
	const extraParams = {
		website,
		created,
		originalRequestParameters: sendTransactionParams,
		transactionIdentifier,
		error: undefined,
	}
	if (transactionDetails.gas === undefined) {
		const estimateGas = await simulateEstimateGas(ethereumClientService, simulationState, transactionWithoutGas)
		if ('error' in estimateGas) return { ...extraParams, ...estimateGas, success: false }
		return { transaction: { ...transactionWithoutGas, gas: estimateGas.gas }, ...extraParams, success: true }
	}
	return { transaction: { ...transactionWithoutGas, gas: transactionDetails.gas }, ...extraParams, success: true }
}

const getPendingTransactionWindow = async (simulator: Simulator, websiteTabConnections: WebsiteTabConnections) => {
	const pendingTransactions = await getPendingTransactionsAndMessages()
	const [firstPendingTransaction] = pendingTransactions
	if (firstPendingTransaction !== undefined) {
		const alreadyOpenWindow = await getPopupOrTabById(firstPendingTransaction.popupOrTabId)
		if (alreadyOpenWindow) return alreadyOpenWindow
		await resolveAllPendingTransactionsAndMessageAsNoResponse(pendingTransactions, simulator, websiteTabConnections)
	}
	return await openPopupOrTab({ url: getHtmlFile('confirmTransaction'), type: 'popup', height: 800, width: 600 })
}


export async function openConfirmTransactionDialogForMessage(
	simulator: Simulator,
	ethereumClientService: EthereumClientService,
	request: InterceptedRequest,
	transactionParams: SignMessageParams,
	simulationMode: boolean,
	activeAddress: bigint | undefined,
	website: Website,
	websiteTabConnections: WebsiteTabConnections,
) {
	if (activeAddress === undefined) return { type: 'result' as const, ...ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS }
	const uniqueRequestIdentifierString = getUniqueRequestIdentifierString(request.uniqueRequestIdentifier)
	const messageIdentifier = EthereumQuantity.parse(keccak256(toUtf8Bytes(uniqueRequestIdentifierString)))
	const created = new Date()
	const signedMessageTransaction = {
		website,
		created,
		originalRequestParameters: transactionParams,
		fakeSignedFor: activeAddress,
		simulationMode,
		request,
		messageIdentifier,
	}
	const visualizedPersonalSignRequestPromise = craftPersonalSignPopupMessage(ethereumClientService, signedMessageTransaction, ethereumClientService.getRpcEntry())
	try {
		await pendingConfirmationSemaphore.execute(async () => {
			const openedDialog = await getPendingTransactionWindow(simulator, websiteTabConnections)
			if (openedDialog === undefined) throw new Error('Failed to get pending transaction window!')

			const pendingMessage = {
				type: 'SignableMessage' as const,
				popupOrTabId: openedDialog,
				originalRequestParameters: transactionParams,
				uniqueRequestIdentifier: request.uniqueRequestIdentifier,
				simulationMode,
				activeAddress,
				created,
				transactionOrMessageCreationStatus: 'Crafting' as const,
				website,
				approvalStatus: { status: 'WaitingForUser' as const },
				signedMessageTransaction,
			}
			await appendPendingTransactionOrMessage(pendingMessage)
			await updateConfirmTransactionView(ethereumClientService)

			await updatePendingTransactionOrMessage(pendingMessage.uniqueRequestIdentifier, async (message) => {
				if (message.type !== 'SignableMessage') return message
				return { ...message, transactionOrMessageCreationStatus: 'Simulating' as const }
			})
			await updateConfirmTransactionView(ethereumClientService)
			
			await updatePendingTransactionOrMessage(pendingMessage.uniqueRequestIdentifier, async (message) => {
				if (message.type !== 'SignableMessage') return message
				return { ...message, visualizedPersonalSignRequest: await visualizedPersonalSignRequestPromise, transactionOrMessageCreationStatus: 'Simulated' as const }
			})
			await updateConfirmTransactionView(ethereumClientService)
			
			await tryFocusingTabOrWindow(openedDialog)
		})
	} catch(e) {
		await handleUnexpectedError(e)
	}
	const pendingTransactionData = await getPendingTransactionOrMessageByidentifier(request.uniqueRequestIdentifier)
	if (pendingTransactionData === undefined) return formRejectMessage(undefined)
	return { type: 'doNotReply' as const }
}

export async function openConfirmTransactionDialogForTransaction(
	simulator: Simulator,
	ethereumClientService: EthereumClientService,
	request: InterceptedRequest,
	transactionParams: SendTransactionParams | SendRawTransactionParams,
	simulationMode: boolean,
	activeAddress: bigint | undefined,
	website: Website,
	websiteTabConnections: WebsiteTabConnections,
) {
	const uniqueRequestIdentifierString = getUniqueRequestIdentifierString(request.uniqueRequestIdentifier)
	const transactionIdentifier = EthereumQuantity.parse(keccak256(toUtf8Bytes(uniqueRequestIdentifierString)))
	const created = new Date()
	const transactionToSimulatePromise = transactionParams.method === 'eth_sendTransaction' ? formEthSendTransaction(ethereumClientService, activeAddress, website, transactionParams, created, transactionIdentifier, simulationMode) : formSendRawTransaction(ethereumClientService, transactionParams, website, created, transactionIdentifier)
	if (activeAddress === undefined) return { type: 'result' as const, ...ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS }
	await pendingConfirmationSemaphore.execute(async () => {
		const openedDialog = await getPendingTransactionWindow(simulator, websiteTabConnections)
		if (openedDialog === undefined) throw new Error('Failed to get pending transaction window!')

		const pendingTransaction =  {
			type: 'Transaction' as const,
			popupOrTabId: openedDialog,
			originalRequestParameters: transactionParams,
			uniqueRequestIdentifier: request.uniqueRequestIdentifier,
			simulationMode,
			activeAddress,
			created,
			transactionOrMessageCreationStatus: 'Crafting' as const,
			transactionIdentifier,
			website,
			approvalStatus: { status: 'WaitingForUser' as const }
		}
		await appendPendingTransactionOrMessage(pendingTransaction)
		await updateConfirmTransactionView(ethereumClientService)

		const transactionToSimulate = await transactionToSimulatePromise
		
		if (transactionToSimulate.success === false) {
			await updatePendingTransactionOrMessage(pendingTransaction.uniqueRequestIdentifier, async (transaction) => {
				if (transaction.type !== 'Transaction') return transaction
				return {
					...transaction,
					transactionToSimulate,
					simulationResults: await refreshConfirmTransactionSimulation(simulator, ethereumClientService, activeAddress, simulationMode, request.uniqueRequestIdentifier, transactionToSimulate),
					transactionOrMessageCreationStatus: 'FailedToSimulate' as const,
				}
			})
		} else {
			await updatePendingTransactionOrMessage(pendingTransaction.uniqueRequestIdentifier, async (transaction) => ({ ...transaction, transactionToSimulate: transactionToSimulate, transactionOrMessageCreationStatus: 'Simulating' as const }))
			await updateConfirmTransactionView(ethereumClientService)
			await updatePendingTransactionOrMessage(pendingTransaction.uniqueRequestIdentifier, async (transaction) => {
				if (transaction.type !== 'Transaction') return transaction
				return {
					...transaction,
					transactionToSimulate,
					simulationResults: await refreshConfirmTransactionSimulation(simulator, ethereumClientService, activeAddress, simulationMode, request.uniqueRequestIdentifier, transactionToSimulate),
					transactionOrMessageCreationStatus: 'Simulated' as const,
				}
			})
		}
		await updateConfirmTransactionView(ethereumClientService)
		await tryFocusingTabOrWindow(openedDialog)
	})

	const pendingTransactionData = await getPendingTransactionOrMessageByidentifier(request.uniqueRequestIdentifier)
	
	if (pendingTransactionData === undefined) return formRejectMessage(undefined)
	return { type: 'doNotReply' as const }
}
