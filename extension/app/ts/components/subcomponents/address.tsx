import { ethers } from 'ethers'
import { addressString } from '../../utils/bigint.js'
import { AddressMetadata } from '../../utils/visualizer-types.js'
import Blockie from './PreactBlocky.js'
import { AddressInfo, RenameAddressCallBack } from '../../utils/user-interface-types.js'
import { CopyToClipboard } from './CopyToClipboard.js'
import { ApproveIcon, ArrowIcon } from '../subcomponents/icons.js'
import RenameAddressButton from './RenameAddressButton.js'

export function findAddressInfo(addressToFind: bigint, addressInfos: readonly AddressInfo[]) {
	for (const info of addressInfos) {
		if (info.address === addressToFind) {
			return info
		}
	}
	return {
		name: ethers.utils.getAddress(addressString(addressToFind)),
		address: addressToFind,
		askForAddressAccess: true,
	}
}

export type BigAddressParams = {
	readonly address: bigint
	readonly title?: string
	readonly subtitle?: string
	readonly noCopying?: boolean
	readonly renameAddressCallBack: RenameAddressCallBack
}

export function BigAddress(params: BigAddressParams) {
	const title = params.title === undefined ? ethers.utils.getAddress(addressString(params.address)): params.title
	const addrString = ethers.utils.getAddress(addressString(params.address))
	const subTitle = params.subtitle === undefined && title != addrString ? addrString : params.subtitle

	return <div class = 'media'>
		<div class = 'media-left'>
			{ !params.noCopying ?
				<CopyToClipboard content = { ethers.utils.getAddress(addressString(params.address)) } copyMessage = 'Address copied!'>
					<figure class = 'image noselect nopointer'>
						<Blockie seed = { addressString(params.address).toLowerCase() } size = { 8 } scale = { 5 } />
					</figure>
				</CopyToClipboard>
			:
				<figure class = 'image noselect nopointer'>
					<Blockie seed = { addressString(params.address).toLowerCase() } size = { 8 } scale = { 5 } />
				</figure>
			}
		</div>

		<div class = 'media-content' style = 'overflow-y: hidden; overflow-x: clip; display: block;'>
			<div style = 'display: flex; position: relative;'>
				<RenameAddressButton renameAddress = { () => params.renameAddressCallBack(title, addressString(params.address)) }>
					{ !params.noCopying ?
						<CopyToClipboard content = { ethers.utils.getAddress(addressString(params.address)) } copyMessage = 'Address copied!'>
							<p class = 'title is-5 noselect nopointer is-spaced' style = 'text-overflow: ellipsis; white-space: nowrap;'>
								{ title }
							</p>
						</CopyToClipboard>
					:
						<p class = 'title is-5 noselect nopointer is-spaced' style = 'text-overflow: ellipsis; white-space: nowrap;'>
							{ title }
						</p>
					}
				</RenameAddressButton>
			</div>
			{ !params.noCopying ?
				<CopyToClipboard content = { ethers.utils.getAddress(addressString(params.address)) } copyMessage = 'Address copied!'>
					<p class = 'subtitle is-7 noselect nopointer' style = 'text-overflow: ellipsis; white-space: nowrap;'>
						{ subTitle === undefined ? '' : subTitle }
					</p>
				</CopyToClipboard>
			:
				<p class = 'subtitle is-7 noselect nopointer' style = 'text-overflow: ellipsis; white-space: nowrap;'>
					{ subTitle === undefined ? '' : subTitle }
				</p>
			}
		</div>
	</div>
}

export type ActiveAddressParams = {
	readonly address: bigint
	readonly title?: string
	readonly subtitle?: string
	readonly simulationMode: boolean
	readonly changeActiveAddress: () => void
	readonly renameAddressCallBack: RenameAddressCallBack
}

export function ActiveAddress(params: ActiveAddressParams) {
	const title = params.title === undefined ? ethers.utils.getAddress(addressString(params.address)): params.title
	const addrString = ethers.utils.getAddress(addressString(params.address))
	const subTitle = params.subtitle === undefined && title != addrString ? addrString : params.subtitle

	return <div class = 'media'>
		<div class = 'media-left'>
			<CopyToClipboard content = { ethers.utils.getAddress(addressString(params.address)) } copyMessage = 'Address copied!'>
				<figure class = 'image noselect nopointer'>
					<Blockie seed = { addressString(params.address).toLowerCase() } size = { 8 } scale = { 5 } />
				</figure>
			</CopyToClipboard>
		</div>

		<div class = 'media-content' style = 'overflow-y: hidden;'>
			<div style = 'display: flex; position: relative;'>
				<RenameAddressButton renameAddress = { () => params.renameAddressCallBack(title, addressString(params.address)) }>
					<CopyToClipboard content = { ethers.utils.getAddress(addressString(params.address)) } copyMessage = 'Address copied!'>
						<p class = 'title is-5 noselect nopointer' style = 'text-overflow: ellipsis; white-space: nowrap;'>
							{ title }
						</p>
					</CopyToClipboard>
				</RenameAddressButton>
			</div>
			<CopyToClipboard content = { ethers.utils.getAddress(addressString(params.address)) } copyMessage = 'Address copied!'>
				<p class = 'subtitle is-7 noselect nopointer'>
					{ subTitle === undefined ? '' : subTitle }
				</p>
			</CopyToClipboard>
		</div>

		<div class = 'media-right'>
			<button className = 'button is-primary' disabled = { !params.simulationMode } onClick = { params.changeActiveAddress } >
				Change
			</button>
		</div>
	</div>
}

export type SmallAddressParams = {
	readonly address: bigint
	readonly addressMetaData: AddressMetadata | undefined
	readonly textColor?: string
	readonly renameAddressCallBack: RenameAddressCallBack
}

export function getAddressName(address: bigint, metadata: AddressMetadata | undefined) {
	if ( metadata === undefined ) return ethers.utils.getAddress(addressString(address))
	return metadata.name
}

export function SmallAddress(params: SmallAddressParams) {
	const name = getAddressName(params.address, params.addressMetaData)
	const textColor = params.textColor === undefined ? 'var(--text-color)' : params.textColor

	return	<CopyToClipboard content = { ethers.utils.getAddress(addressString(params.address)) } copyMessage = 'Address copied!'>
		<div style = 'display: inline-flex; width: 100%; position: relative;'>
			<span class = 'vertical-center noselect nopointer' style = 'margin-right: 5px'>
				<Blockie seed = { addressString(params.address).toLowerCase() } size = { 8 } scale = { 3 } />
			</span>
			<RenameAddressButton renameAddress = { () => params.renameAddressCallBack(name, addressString(params.address)) }>
				<span class = 'noselect nopointer' style = { `color: ${ textColor }; overflow: hidden; text-overflow: ellipsis;` } >
					{ name }
				</span>
			</RenameAddressButton>
		</div>
	</CopyToClipboard>
}

export type FromAddressToAddressParams = {
	readonly from: bigint
	readonly to: bigint
	readonly fromAddressMetadata: AddressMetadata | undefined
	readonly toAddressMetadata: AddressMetadata | undefined
	readonly isApproval: boolean
	readonly renameAddressCallBack: RenameAddressCallBack
}

export function FromAddressToAddress(params: FromAddressToAddressParams ) {
	return  <div class = 'columns is-mobile' style = 'margin-bottom: 0px; color: var(--text-color);'>
		<div class = 'column' style = 'width: 47.5%; flex: none; padding-bottom: 0px;'>
			<BigAddress address = { params.from } title = { params.fromAddressMetadata?.name } renameAddressCallBack = { params.renameAddressCallBack }/>
		</div>
		<div class = 'column' style = 'width: 5%; padding: 0px; align-self: center; flex: none;'>
			{ params.isApproval ? <ApproveIcon color = { 'var(--text-color)' }/> : <ArrowIcon color = { 'var(--text-color)' }/> }
		</div>
		<div class = 'column' style = 'width: 47.5%; flex: none; padding-bottom: 0px;'>
			<BigAddress address = { params.to } title = { params.toAddressMetadata?.name } renameAddressCallBack = { params.renameAddressCallBack }/>
		</div>
	</div>
}
