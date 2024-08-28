import { Signal } from "@rbxts/beacon";
import { make, SignalView } from "shared/util";

export class CyclableOptionsInput<T extends defined>{
	private static readonly InstanceTemplate = make("TextButton", {
		Name: "CyclableOptionsInput",
		Size: UDim2.fromOffset(100, 30),
		RichText: true,
		TextScaled: true,
		Children: {
			TextSizeConstraint: make("UITextSizeConstraint", {
				MaxTextSize: 8
			})
		}
	});

	public static GetToggleStatusEmoji(checked: boolean): string {
		return checked ? "✅" : "❌"
	}

	private readonly ChangedController = new Signal<[value: T]>();
	public readonly Changed = this.ChangedController as SignalView<[value: T]>;
	public readonly Instance: typeof CyclableOptionsInput.InstanceTemplate;

	private Index: number;

	private IndexOf(value: T): number | undefined {
		const index = this.Options.indexOf(value);
		if (index !== -1) return index;
		return index;
	}

	/**
	 * @returns whether successful
	 */
	public SetCurrent(value: T): boolean {
		const index = this.IndexOf(value);
		if (index === undefined) return false;
		this.Index = index;
		this.UpdateText()
		return true;
	}

	private PeekAheadIndex(distance = 1) {
		return (this.Index + distance) % this.Options.size()
	}

	public Peek(distance = 1) {
		return this.Options[this.PeekAheadIndex(distance)]
	}
	public GetCurrent() {
		return this.Options[this.Index]
	}

	private Adjust(travel = 1) {
		this.Index = this.PeekAheadIndex(travel);
		this.ChangedController.Fire(this.GetCurrent())
	}
	private UpdateText(with_value: T = this.GetCurrent()) {
		this.Instance.Text = this.Label + ": <b>" + this.FormatOption(with_value) + "</b>"
	}

	constructor(label: string, name: string | undefined, options: T[],            format : (value: T) => string,      initial?:      T | undefined, parent?: GuiBase | undefined, callback?: (value: T)          => void)
	constructor(label: string, name: string | undefined, options: (T & string)[], format?: (value: string) => string, initial?: string | undefined, parent?: GuiBase | undefined, callback?: (value: T & string) => void)
	constructor(
		public readonly Label: string,
		name: string | undefined,
		public readonly Options: T[],
		public readonly FormatOption: (value: T) => string = (value) => tostring(value),
		initial: T = Options[0],
		parent?: GuiBase | undefined,
		callback?: (value: T) => void
	) {
		this.Index = Options.indexOf(initial)
		this.Instance = CyclableOptionsInput.InstanceTemplate.Clone();
		this.Instance.MouseButton1Click.Connect(() => this.Adjust())
		this.Instance.MouseButton2Click.Connect(() => this.Adjust(-1))
		this.Changed.Connect(() => this.UpdateText())
		this.UpdateText();
		this.Instance.Name = name ?? Label;
		this.Instance.Parent = parent;
		if (callback) this.Changed.Connect((value) => callback(value))
	}

	public Destroy(): void {
		this.Instance.Destroy();
		this.ChangedController.Destroy();
	}
}

export namespace CyclableOptionsInput {
	export type Instance = CyclableOptionsInput<defined>["Instance"]
}
