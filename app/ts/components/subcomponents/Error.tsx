import type { ComponentChild } from 'preact'

interface ErrorProps {
	text: ComponentChild
	warning?: boolean,
}

export function ErrorComponent(props: ErrorProps) {
	const boxColor = props.warning === true ? 'var(--warning-box-color)' : 'var(--error-box-color)'
	const textColor = props.warning === true ? 'var(--warning-box-text)' : 'var(--error-box-text)'
	return (
		<div class = 'container' style = 'margin: 10px; background-color: var(--bg-color);'>
			<div className = 'notification' style = { `background-color: ${ boxColor }; display: flex; align-items: center; padding: 2px; padding: 10px`}>
				<span class = 'icon' style = 'margin-left: 0px; margin-right: 5px; width: 2em; height: 2em; min-width: 2em; min-height: 2em;'>
					<img src = '../img/warning-sign-black.svg' style = 'width: 2em; height: 2em;'/>
				</span>
				<p className = 'paragraph' style = { `marging-left: 10px; color: ${ textColor }` }> { props.text } </p>
			</div>
		</div>
	)
}

export function Notice(props: ErrorProps) {
	return (
		<div class = 'container'>
			<div className = 'notification' style = { `background-color: unset; display: flex; align-items: center; padding: 0px;` }>
				<p className = 'paragraph' style = 'marging-left: 10px'> { props.text } </p>
			</div>
		</div>
	)
}

interface ErrorCheckboxProps {
	text: string
	checked: boolean
	onInput: (checked: boolean) => void
	warning?: boolean,
}

export function ErrorCheckBox(props: ErrorCheckboxProps) {
	const boxColor = props.warning === true ? 'var(--warning-box-color)' : 'var(--error-box-color)'
	const textColor = props.warning === true ? 'var(--warning-box-text)' : 'var(--error-box-text)'
	return (
		<div class = 'container'>
			<div className = 'notification' style = { `background-color: ${ boxColor }; padding: 10px;` }>
				<label class = 'form-control' style = { `color: ${ textColor }; font-size: 1em;` }>
					<input type = 'checkbox'
						checked = { props.checked }
						onInput = { e => { if (e.target instanceof HTMLInputElement && e.target !== null) { props.onInput(e.target.checked) } } }
					/>
					<p class = 'paragraph checkbox-text' style = { `color: ${ textColor };` }> { props.text } </p>
				</label>
			</div>
		</div>
	)
}

type UnexpectedErrorParams = {
	message: string | undefined
	close: () => void
}

export const UnexpectedError = ({ message, close }: UnexpectedErrorParams) => {
	if (message === undefined) return <></>
	return (
		<div class = 'container' style = {'padding: 10px;'}>
			<div className = 'notification' style = { `background-color: var(--error-box-color); padding: 10px;` }>
				<div style = 'display: flex; padding-bottom: 10px;'>
					<span class = 'icon' style = 'margin-left: 0px; margin-right: 5px; width: 2em; height: 2em; min-width: 2em; min-height: 2em;'>
						<img src = '../img/warning-sign-black.svg' style = 'width: 2em; height: 2em;'/>
					</span>
					<p className = 'paragraph' style = { `marging-left: 10px; color: var(--error-box-text); align-self: center; font-weight: bold;` }> { 'An unexpected error occured!' } </p>
				</div>
				<div style = { `overflow-y: auto; overflow-x: hidden; max-height: 200px; border-style: solid;` }>
					<p class = 'paragraph' style = { `color: var(--error-box-text);` }> { message } </p>
				</div>
				<div style = 'overflow: hidden; display: flex; justify-content: space-around; width: 100%; height: 50px; padding-top: 10px;'>
					<button class = 'button is-success is-primary' onClick = { close }> { 'close' } </button>
				</div>
			</div>
		</div>
	)
}
