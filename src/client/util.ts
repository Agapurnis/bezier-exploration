import { Signal } from "@rbxts/beacon";
import { SignalView } from "shared/util";

const player = game.GetService("Players").LocalPlayer;

export function get_character(): Model {
	return player.Character ?? player.CharacterAdded.Wait()[0];
}

export class SubscribableRememberingStore<T> {
	private readonly SignalController = new Signal<[new: T, old: T]>()
	public readonly Signal = this.SignalController as SignalView<[new: T, old: T]>
	private State: T;
	constructor (value: T) { this.State = value }
	public Set(value: T) {
		const old = this.State;
		this.State = value;
		if (value !== old) this.SignalController.Fire(value, old);
	}
	public Get(): T {
		return this.State
	}
}

export class SubscribableStore<T> {
	private readonly SignalController = new Signal<[T]>()
	public readonly Signal = this.SignalController as SignalView<[T]>
	private State: T;
	constructor (value: T) { this.State = value }
	public Set(value: T) {
		const old = this.State;
		this.State = value;
		if (value !== old) this.SignalController.Fire(value);
	}
	public Get(): T {
		return this.State
	}
}


