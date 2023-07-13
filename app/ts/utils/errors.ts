import { JsonRpcErrorResponse } from './JsonRpc-types.js'

export class ErrorWithData extends Error {
	public constructor(message: string, public data: unknown) {
		super(message)
		Object.setPrototypeOf(this, ErrorWithData)
	}
}

export class JsonRpcResponseError extends ErrorWithData {
	public readonly id: string | number
	public readonly code: number
	public constructor(jsonRpcResponse: JsonRpcErrorResponse) {
		super(jsonRpcResponse.error.message, jsonRpcResponse.error.data)
		this.code = jsonRpcResponse.error.code
		this.id = jsonRpcResponse.id
	}
}

export class FetchResponseError extends ErrorWithData {
	public readonly id: string | number
	public readonly code: number
	public constructor(response: Response, id: number) {
		super(response.statusText, undefined)
		this.code = response.status
		this.id = id
	}
}

export function isFailedToFetchError(error: Error) {
	if (error.message.includes('Failed to fetch')) return true
	return false
}
