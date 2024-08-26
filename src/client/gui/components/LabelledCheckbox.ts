import { make } from "shared/util";

export class LabelledCheckbox {
	private static readonly InstanceTemplate = make("TextButton", {
		Name: "Checkbox",
		Size: UDim2.fromOffset(100, 30)
	});

	public static GetToggleStatusEmoji(checked: boolean): string {
		return checked ? "✅" : "❌"
	}

	private readonly ChangedController: BindableEvent<(checked: boolean) => void> = new Instance("BindableEvent");
	public readonly Changed = this.ChangedController.Event;
	public readonly Instance: typeof LabelledCheckbox.InstanceTemplate;

	private UpdateText(as_being_checked = this.Checked) {
		this.Instance.Text = this.Label + ": " + LabelledCheckbox.GetToggleStatusEmoji(as_being_checked)
	}

	public IsChecked() { return this.Checked }
	public Set(checked: boolean) {
		const old = this.Checked;
		this.Checked = checked;
		if (checked !== old) this.ChangedController.Fire(checked)
	}
	public Toggle() {
		this.Checked = !this.Checked;
		this.ChangedController.Fire(this.Checked)
	}

	constructor(
		public readonly Label: string,
		name: string | undefined,
		private Checked = false,
		parent?: GuiBase | undefined,
		callback?: (checked: boolean) => void
	) {
		this.Instance = LabelledCheckbox.InstanceTemplate.Clone();
		this.Instance.Name = name ?? Label;
		this.Changed.Connect(() => this.UpdateText())
		this.Instance.MouseButton1Up.Connect(() => this.Toggle())
		this.UpdateText()
		this.Instance.Parent = parent;
		if (callback) this.Changed.Connect((checked) => callback(checked))
	}

	public Destroy(): void {
		this.Instance.Destroy();
		this.ChangedController.Destroy();
	}
}

export namespace LabelledCheckbox {
	export type Instance = LabelledCheckbox["Instance"]
}
