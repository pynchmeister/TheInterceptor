import { HomeParams, FirstCardParams, SimulationStateParam, RpcConnectionStatus, TabIconDetails, TabIcon, TabState } from '../../types/user-interface-types.js'
import { useEffect, useState } from 'preact/hooks'
import { SimulationAndVisualisationResults, SimulationUpdatingState, SimulationResultState } from '../../types/visualizer-types.js'
import { ActiveAddressComponent, WebsiteOriginText, getActiveAddressEntry } from '../subcomponents/address.js'
import { SimulationSummary } from '../simulationExplaining/SimulationSummary.js'
import { ChainSelector } from '../subcomponents/ChainSelector.js'
import { DEFAULT_TAB_CONNECTION, ICON_ACTIVE, ICON_INTERCEPTOR_DISABLED, ICON_NOT_ACTIVE, ICON_SIGNING, ICON_SIGNING_NOT_SUPPORTED } from '../../utils/constants.js'
import { getPrettySignerName, SignerLogoText, SignersLogoName } from '../subcomponents/signers.js'
import { ErrorComponent } from '../subcomponents/Error.js'
import { ToolTip } from '../subcomponents/CopyToClipboard.js'
import { sendPopupMessageToBackgroundPage } from '../../background/backgroundUtils.js'
import { TransactionsAndSignedMessages } from '../simulationExplaining/Transactions.js'
import { DinoSays } from '../subcomponents/DinoSays.js'
import { ActiveAddress, ActiveAddressEntry } from '../../types/addressBookTypes.js'
import { SignerName } from '../../types/signerTypes.js'
import { RpcEntries, RpcEntry, RpcNetwork } from '../../types/rpc.js'
import { Website } from '../../types/websiteAccessTypes.js'
import { TransactionOrMessageIdentifier } from '../../types/interceptor-messages.js'

async function enableMakeMeRich(enabled: boolean) {
	sendPopupMessageToBackgroundPage( { method: 'popup_changeMakeMeRich', data: enabled } )
}

type SignerExplanationParams = {
	activeAddress: ActiveAddress | undefined
	simulationMode: boolean
	signerName: SignerName
	useSignersAddressAsActiveAddress: boolean
	tabIcon: TabIcon
}

function SignerExplanation(param: SignerExplanationParams) {
	if (param.activeAddress !== undefined) return <></>
	if (param.tabIcon === ICON_NOT_ACTIVE) {
		return <>
			<div class = 'notification' style = 'background-color: var(--card-content-bg-color); padding: 10px; margin: 10px;'>
				<DinoSays text = 'The page you are looking at has not connected to a wallet, or you do not have a browser wallet installed.'/>
			</div>
		</>
	}
	if (param.useSignersAddressAsActiveAddress || !param.simulationMode) {
		return  <>
			<div class = 'notification' style = 'background-color: var(--card-content-bg-color); padding: 10px; margin: 10px;'>
				<DinoSays text = { `Please make sure that you have gone through the wallet connection process on the page and allowed the page to see your ${ param.signerName === 'NoSigner' ? 'signer' : getPrettySignerName(param.signerName) } account.` }/>
			</div>
		</>
	}
	return <></>
}

function FirstCardHeader(param: FirstCardParams) {
	return <>
		<header class = 'card-header'>
			<div class = 'card-header-icon unset-cursor'>
				<span class = 'icon' style = 'height: 3rem; width: 3rem;'>
					<ToolTip content = {  param.tabIconDetails.iconReason }>
						<img className = 'noselect nopointer' src = { param.tabIconDetails.icon } />
					</ToolTip>
				</span>
			</div>
			<div class = 'card-header-title px-0 is-justify-content-center'>
				<div class = 'buttons has-addons' style = 'border-style: solid; border-color: var(--primary-color); border-radius: 4px; padding: 1px; border-width: 1px; margin-bottom: 0px; flex-wrap: nowrap;' >
					<button
						class = { `button is-primary ${ param.simulationMode ? '' : 'is-outlined' }` }
						style = { `margin-bottom: 0px; ${ param.simulationMode ? 'opacity: 1;' : 'border-style: none;' }` }
						disabled = { param.simulationMode }
						onClick = { () => param.enableSimulationMode(true) }>
						Simulating
					</button>
					<button
						class = { `button is-primary ${ param.simulationMode ? 'is-outlined' : ''}` }
						style = { `margin-bottom: 0px; ${ param.simulationMode ? 'border-style: none;' : 'opacity: 1;' }` }
						disabled = { !param.simulationMode }
						onClick = { () => param.enableSimulationMode(false) }>
						<SignerLogoText signerName = { param.signerName } text = { 'Signing' } />
					</button>
				</div>
			</div>
			<div class = 'card-header-icon unset-cursor'>
				<ChainSelector rpcEntries = { param.rpcEntries } rpcNetwork = { param.rpcNetwork } changeRpc = { (entry: RpcEntry) => { param.changeActiveRpc(entry) } }/>
			</div>
		</header>
	</>
}

type InterceptorDisabledButtonParams = {
	disableInterceptorToggle: (disabled: boolean) => void,
	interceptorDisabled: boolean,
	website: Website | undefined
}

function InterceptorDisabledButton({ disableInterceptorToggle, interceptorDisabled, website }: InterceptorDisabledButtonParams) {
	return <button disabled = { website === undefined } className = { `button is-small ${ interceptorDisabled ? 'is-success' : 'is-primary' }` } onClick = { () => disableInterceptorToggle(!interceptorDisabled) } >
		{ interceptorDisabled ? <>
			<span class = 'icon'> <img src = { ICON_ACTIVE }/> </span>
			<span> Enable</span>
		</> : <>
			<span class = 'icon'> <img src = { ICON_INTERCEPTOR_DISABLED }/> </span>
			<span> Disable</span>
		</> }
	</button>
}

function FirstCard(param: FirstCardParams) {
	function connectToSigner() {
		sendPopupMessageToBackgroundPage({ method: 'popup_requestAccountsFromSigner', data: true })
	}

	if (param.signerName === 'NoSigner' && param.simulationMode === false) {
		return <>
			<div class = 'card' style = 'margin: 10px;'>
				<FirstCardHeader { ...param }/>
				<div class = 'card-content'>
					<DinoSays text = { 'No signer connnected. You can use Interceptor in simulation mode without a signer, but signing mode requires a browser wallet.' } />
				</div>
			</div>
		</>
	}

	return <>
		<div class = 'card' style = 'margin: 10px;'>
			<FirstCardHeader { ...param }/>
			<div class = 'card-content'>
				{ param.useSignersAddressAsActiveAddress || !param.simulationMode ?
					<p style = 'color: var(--text-color); text-align: left; padding-bottom: 10px'>
						{ param.signerName === 'NoSigner'
							? 'Retrieving address from a signer'
							: <>Retrieving from&nbsp;<SignersLogoName signerName = { param.signerName } /></>
						}
						{ param.signerAccounts !== undefined && param.signerAccounts.length > 0 && param.tabIconDetails.icon !== ICON_NOT_ACTIVE ? <span style = 'float: right; color: var(--primary-color);'> CONNECTED </span> :
							param.tabIconDetails.icon === ICON_SIGNING || param.tabIconDetails.icon === ICON_SIGNING_NOT_SUPPORTED ? <span style = 'float: right; color: var(--negative-color);'> NOT CONNECTED </span> : <></>
						}
					</p>
					: <></>
				}

				<ActiveAddressComponent
					activeAddress = { param.activeAddress !== undefined ? { type: 'activeAddress', ...param.activeAddress, entrySource: 'User' } : undefined }
					buttonText = { 'Change' }
					disableButton = { !param.simulationMode }
					changeActiveAddress = { param.changeActiveAddress }
					renameAddressCallBack = { param.renameAddressCallBack }
				/>
				{ !param.simulationMode ? <>
					{ ( (param.signerAccounts === undefined || param.signerAccounts.length === 0) && param.tabIconDetails.icon !== ICON_NOT_ACTIVE ) ?
						<div style = 'margin-top: 5px'>
							<button className = 'button is-primary' onClick = { connectToSigner } >
								<SignerLogoText
									signerName = { param.signerName }
									text = { `Connect to ${ getPrettySignerName(param.signerName) }` }
								/>
							</button>
						</div>
						: <p style = 'color: var(--subtitle-text-color);' class = 'subtitle is-7'> { ` You can change active address by changing it directly from ${ getPrettySignerName(param.signerName) }` } </p>
					}
				</> : <div style = 'display: flex; justify-content: space-between; padding-top: 10px'>
					<label class = 'form-control'>
						<input type = 'checkbox' checked = { param.makeMeRich } onInput = { e => { if (e.target instanceof HTMLInputElement && e.target !== null) { enableMakeMeRich(e.target.checked) } } } />
						<p class = 'paragraph checkbox-text'>Make me rich</p>
					</label>
				</div> }
			</div>
		</div>
	
		<SignerExplanation
			activeAddress = { param.activeAddress }
			simulationMode = { param.simulationMode }
			signerName = { param.signerName }
			useSignersAddressAsActiveAddress = { param.useSignersAddressAsActiveAddress }
			tabIcon = { param.tabIconDetails.icon }
		/>
	</>
}

function SimulationResults(param: SimulationStateParam) {
	if (param.simulationAndVisualisationResults === undefined) return <></>
	if (param.simulationAndVisualisationResults.simulatedAndVisualizedTransactions.length === 0 && param.simulationAndVisualisationResults.visualizedPersonalSignRequests.length === 0) {
		return <div style = 'padding: 10px'> <DinoSays text = { 'Give me some transactions to munch on!' } /> </div>
	}

	return <div>
		<div style = 'display: grid; grid-template-columns: auto auto; padding-left: 10px; padding-right: 10px' >
			<div class = 'log-cell' style = 'justify-content: left;'>
				<p className = 'h1'> Simulation Results </p>
			</div>
			<div class = 'log-cell' style = 'justify-content: right;'>
				<button className = 'button is-small is-danger' disabled = { param.disableReset } onClick = { param.resetSimulation } >
					<span class = 'icon'>
						<img src = '../../img/broom.svg'/>
					</span>
					<span>
						Clear
					</span>
				</button>
			</div>
		</div>

		<div class = { param.simulationResultState === 'invalid' || param.simulationUpdatingState === 'failed' ? 'blur' : '' }>
			<TransactionsAndSignedMessages
				simulationAndVisualisationResults = { param.simulationAndVisualisationResults }
				removeTransactionOrSignedMessage = { param.removeTransactionOrSignedMessage }
				activeAddress = { param.simulationAndVisualisationResults.activeAddress }
				renameAddressCallBack = { param.renameAddressCallBack }
				removedTransactionOrSignedMessages = { param.removedTransactionOrSignedMessages }
				addressMetaData = { param.simulationAndVisualisationResults.addressBookEntries }
			/>
			{ param.removedTransactionOrSignedMessages.length > 0
				? <></>
				: <SimulationSummary
					simulationAndVisualisationResults = { param.simulationAndVisualisationResults }
					currentBlockNumber = { param.currentBlockNumber }
					renameAddressCallBack = { param.renameAddressCallBack }
					rpcConnectionStatus = { param.rpcConnectionStatus }
				/>
			}
		</div>
		<div class = 'content' style = 'height: 0.1px'/>
	</div>
}

export function Home(param: HomeParams) {
	const [activeSimulationAddress, setActiveSimulationAddress] = useState<ActiveAddress | undefined>(undefined)
	const [activeSigningAddress, setActiveSigningAddress] = useState<ActiveAddress | undefined>(undefined)
	const [useSignersAddressAsActiveAddress, setUseSignersAddressAsActiveAddress] = useState(false)
	const [simulationAndVisualisationResults, setSimulationAndVisualisationResults] = useState<SimulationAndVisualisationResults | undefined>(undefined)
	const [rpcNetwork, setSelectedNetwork] = useState<RpcNetwork | undefined>()
	const [simulationMode, setSimulationMode] = useState<boolean>(true)
	const [tabIconDetails, setTabConnection] = useState<TabIconDetails>(DEFAULT_TAB_CONNECTION)
	const [tabState, setTabState] = useState<TabState | undefined>(undefined)
	const [isLoaded, setLoaded] = useState<boolean>(false)
	const [currentBlockNumber, setCurrentBlockNumber] = useState<bigint | undefined>(undefined)
	const [activeAddresses, setActiveAddresss] = useState<readonly ActiveAddressEntry[] | undefined>(undefined)
	const [makeMeRich, setMakeMeRich] = useState<boolean>(false)
	const [disableReset, setDisableReset] = useState<boolean>(false)
	const [removedTransactionOrSignedMessages, setRemovedTransactionOrSignedMessages] = useState<readonly TransactionOrMessageIdentifier[]>([])
	const [rpcConnectionStatus, setRpcConnectionStatus] = useState<RpcConnectionStatus>(undefined)
	const [rpcEntries, setRPCEntries] = useState<RpcEntries>([])
	const [simulationUpdatingState, setSimulationUpdatingState] = useState<SimulationUpdatingState | undefined>(undefined)
	const [simulationResultState, setSimulationResultState] = useState<SimulationResultState | undefined>(undefined)
	const [interceptorDisabled, setInterceptorDisabled] = useState<boolean>(false)
	
	useEffect(() => {
		setSimulationAndVisualisationResults(param.simVisResults)
		setUseSignersAddressAsActiveAddress(param.useSignersAddressAsActiveAddress)
		setActiveSimulationAddress(param.activeSimulationAddress !== undefined ? getActiveAddressEntry(param.activeSimulationAddress, param.activeAddresses) : undefined)
		setActiveSigningAddress(param.activeSigningAddress !== undefined ? getActiveAddressEntry(param.activeSigningAddress, param.activeAddresses) : undefined)
		setSelectedNetwork(param.rpcNetwork)
		setSimulationMode(param.simulationMode)
		setTabConnection(param.tabIconDetails)
		setTabState(param.tabState)
		setCurrentBlockNumber(param.currentBlockNumber)
		setActiveAddresss(param.activeAddresses)
		setLoaded(true)
		setMakeMeRich(param.makeMeRich)
		setDisableReset(false)
		setRemovedTransactionOrSignedMessages([])
		setRpcConnectionStatus(param.rpcConnectionStatus)
		setRPCEntries(param.rpcEntries)
		setSimulationUpdatingState(param.simulationUpdatingState)
		setSimulationResultState(param.simulationResultState)
		setInterceptorDisabled(param.interceptorDisabled)
	}, [param.activeSigningAddress,
		param.activeSimulationAddress,
		param.tabState,
		param.activeAddresses,
		param.useSignersAddressAsActiveAddress,
		param.rpcNetwork,
		param.simulationMode,
		param.tabIconDetails,
		param.currentBlockNumber,
		param.simVisResults,
		param.rpcConnectionStatus,
		param.rpcEntries,
		param.simulationUpdatingState,
		param.simulationResultState,
		param.interceptorDisabled,
	])

	const changeActiveAddress = () => param.setAndSaveAppPage({ page: 'ChangeActiveAddress' })

	function enableSimulationMode(enabled: boolean ) {
		sendPopupMessageToBackgroundPage( { method: 'popup_enableSimulationMode', data: enabled } )
		setSimulationMode(enabled)
	}

	function resetSimulation() {
		setDisableReset(true)
		sendPopupMessageToBackgroundPage({ method: 'popup_resetSimulation' })
	}

	async function removeTransactionOrSignedMessage(transactionOrMessageIdentifier: TransactionOrMessageIdentifier) {
		if (transactionOrMessageIdentifier.type === 'MakeYouRichTransaction') {
			return await enableMakeMeRich(false)
		} else {
			setRemovedTransactionOrSignedMessages((transactionOrMessageIdentifiers) => transactionOrMessageIdentifiers.concat(transactionOrMessageIdentifier))
			return await sendPopupMessageToBackgroundPage({ method: 'popup_removeTransactionOrSignedMessage', data: transactionOrMessageIdentifier })
		}
	}

	async function disableInterceptorToggle() {
		setInterceptorDisabled((previousValue) => {
			if (tabState?.website === undefined) return previousValue
			const newValue = !previousValue
			sendPopupMessageToBackgroundPage({ method: 'popup_setDisableInterceptor', data: { interceptorDisabled: newValue, website: tabState.website } })
			return previousValue
		})
	}

	if (!isLoaded || rpcNetwork === undefined) return <> </>

	return <>
		{ rpcNetwork.httpsRpc === undefined ?
			<ErrorComponent text = { `${ rpcNetwork.name } is not a supported network. The Interceptors is disabled while you are using the network.` }/>
		: <></> }

		<FirstCard
			activeAddresses = { activeAddresses }
			useSignersAddressAsActiveAddress = { useSignersAddressAsActiveAddress }
			enableSimulationMode = { enableSimulationMode }
			activeAddress = { simulationMode ? activeSimulationAddress : activeSigningAddress }
			rpcNetwork = { rpcNetwork }
			changeActiveRpc = { param.setActiveRpcAndInformAboutIt }
			simulationMode = { simulationMode }
			changeActiveAddress = { changeActiveAddress }
			makeMeRich = { makeMeRich }
			signerAccounts = { tabState?.signerAccounts ?? []}
			tabIconDetails = { tabIconDetails }
			signerName = { tabState?.signerName ?? 'NoSignerDetected' }
			renameAddressCallBack = { param.renameAddressCallBack }
			rpcEntries = { rpcEntries }
		/>

		{ !simulationMode || activeSimulationAddress === undefined
			? <div style = 'display: grid; grid-template-columns: auto auto; padding-left: 10px; padding-right: 10px' >
				<div class = 'log-cell' style = 'justify-content: left;'>
					{ simulationMode ? <div style = 'padding: 10px'> <DinoSays text = { 'No simulation results' } /> </div> : <></> }
				</div>
				<div class = 'log-cell' style = 'justify-content: right;'>
					<button className = 'button is-small is-danger' disabled = { false } onClick = { resetSimulation } >
						<span class = 'icon'>
							<img src = '../../img/broom.svg'/>
						</span>
						<span>
							Clear
						</span>
					</button>
				</div>
			</div>
			: <SimulationResults
				simulationAndVisualisationResults = { simulationAndVisualisationResults }
				removeTransactionOrSignedMessage = { removeTransactionOrSignedMessage }
				disableReset = { disableReset }
				resetSimulation = { resetSimulation }
				currentBlockNumber = { currentBlockNumber }
				renameAddressCallBack = { param.renameAddressCallBack }
				removedTransactionOrSignedMessages = { removedTransactionOrSignedMessages }
				rpcConnectionStatus = { rpcConnectionStatus }
				simulationUpdatingState = { simulationUpdatingState }
				simulationResultState = { simulationResultState }
			/>
		}
		{ tabState?.website === undefined ? <></> : <>
			<div style = 'padding-top: 50px' />
			<div class = 'popup-footer' style = 'display: flex; justify-content: center; flex-direction: column;'>
				<div style = 'display: grid; grid-template-columns: auto auto; padding-left: 10px; padding-right: 10px' >
					<div class = 'log-cell' style = 'justify-content: left;'>
						<WebsiteOriginText { ...tabState?.website } />
					</div>
					<div class = 'log-cell' style = 'justify-content: right; padding-left: 20px'>
						<InterceptorDisabledButton website = { tabState.website } disableInterceptorToggle = { disableInterceptorToggle } interceptorDisabled = { interceptorDisabled }/>
					</div>
				</div>
			</div>
		</> }
	</>
}
