interface Instance {
    /**
	 * @deprecated
	 * @see https://create.roblox.com/docs/reference/engine/classes/Instance#Remove
	 */
    Remove(): void
}


// eslint-disable-next-line roblox-ts/no-namespace-merging
declare namespace table {
    /**
	 * @see https://create.roblox.com/docs/reference/engine/libraries/table#unpack
	 */
    export function unpack(list: object, start?: number, end?: number): LuaTuple<unknown[]>
}
