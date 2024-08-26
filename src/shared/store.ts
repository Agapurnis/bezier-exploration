import { Signal } from "@rbxts/beacon";
import { SignalView } from "./util";

export class SubscribableStore<T> {
	private readonly SignalController = new Signal<[new: T, old: T]>()
	public readonly Signal = this.SignalController as SignalView<[new: T, old: T]>
	private State: T;
	constructor (value: T) { this.State = value }
	/**
	 * @return whether the value change was dispatched; i.e. whether the new value was different from the last one
	 */
	public Set(value: T) {
		const old = this.State;
		this.State = value;
		const changed = value !== old;
		if (changed) this.SignalController.Fire(value, old);
		return changed;
	}
	public Get(): T {
		return this.State
	}
}
