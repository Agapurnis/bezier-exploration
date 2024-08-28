import { make } from "shared/util";

export class ButtonLabelledTextInput {
	private static readonly InstanceTemplate = make("Frame", {
		Name: "ButtonLabelledTextInput",
		Size: UDim2.fromOffset(100, 50),
		Children: {
			TextInput: make("TextBox", {
				BackgroundColor3: new Color3(0.66, 0.66, 0.66),
				Size: UDim2.fromScale(1, 3 / 5)
			}),
			Button: make("TextButton", {
				Size: UDim2.fromScale(1, 2 / 5),
				Position: UDim2.fromScale(0, 3 / 5)
			})
		}
	});

	public static GetToggleStatusEmoji(checked: boolean): string {
		return checked ? "✅" : "❌"
	}

	private readonly SubmissionController: BindableEvent<(value: string) => void> = new Instance("BindableEvent");
	public readonly Submission = this.SubmissionController.Event;
	public readonly Instance: typeof ButtonLabelledTextInput.InstanceTemplate;

	public GetCurrentlyTyped() {
		return this.Instance.TextInput.Text
	}

	public SetContent(text: string) {
		this.Instance.TextInput.Text = text;
	}

	constructor(
		public readonly Name: string | undefined,
		public readonly Label: string,
		initial: string | undefined,
		parent: GuiBase,
		callback?: (value: string) => void
	) {
		this.Instance = ButtonLabelledTextInput.InstanceTemplate.Clone();
		if (Name !== undefined) this.Instance.Name = Name;
		this.Instance.Button.Text = this.Label
		this.Instance.TextInput.Text = initial ?? "";
		this.Instance.Button.MouseButton1Click.Connect((() => this.SubmissionController.Fire(this.GetCurrentlyTyped())))
		this.Instance.Parent = parent;
		if (callback) this.Submission.Connect((value) => callback(value))
	}

	public Destroy(): void {
		this.Instance.Destroy();
		this.SubmissionController.Destroy();
	}
}

export namespace ButtonLabelledTextInput {
	export type Instance = ButtonLabelledTextInput["Instance"]
}
