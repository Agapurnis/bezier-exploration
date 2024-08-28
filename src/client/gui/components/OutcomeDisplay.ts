import { make } from "shared/util";

const BLACK = new Color3(0, 0, 0);

export class OutcomeDisplay {
	public static readonly COLOR_ERROR = new Color3(1, 0.14, 0.14);
	public static readonly COLOR_WARN = new Color3(1, 0.57, 0);
	public static readonly COLOR_NEUTRAL = new Color3(1, 1, 1);
	public static readonly COLOR_INFO = new Color3(0.16, 0.51, 0.9)

	public static GetColor(style: Enum.MessageType): Color3 {
		switch (style) {
			case Enum.MessageType.MessageError:    return this.COLOR_ERROR;
			case Enum.MessageType.MessageWarning:  return this.COLOR_WARN;
			case Enum.MessageType.MessageOutput:   return this.COLOR_NEUTRAL;
			case Enum.MessageType.MessageInfo:     return this.COLOR_INFO;
		}
		error("bad type")
	}

	private static readonly InstanceTemplate = make("TextLabel", {
		Name: "Outcome",
		FontFace: Font.fromEnum(Enum.Font.ArialBold),
		TextScaled: true,
		TextStrokeColor3: BLACK,
		TextStrokeTransparency: 0.5,
		TextXAlignment: Enum.TextXAlignment.Left,
		Position: new UDim2(0.2, 0, 1, -20),
		Size: new UDim2(0.6, 0, 0, 20),
		Text: "",
	})


	private expire_task: thread | undefined
	public Put(Color: Color3, text: string, expire_after_seconds: number) {
		this.Instance.TextColor3 = Color;
		this.Instance.Text = text;
		if (this.expire_task) task.cancel(this.expire_task);
		this.expire_task = task.delay(expire_after_seconds, () => {
			this.Clear()
		})
	}

	public Clear() {
		this.Instance.Text = ""
	}

	public readonly Instance: typeof OutcomeDisplay.InstanceTemplate;

	constructor(parent: GuiBase | undefined) {
		this.Instance = OutcomeDisplay.InstanceTemplate.Clone();
		this.Instance.Parent = parent;
	}
}

export namespace OutcomeDisplay {
	export type Instance = OutcomeDisplay["Instance"];

	export const enum Style {
		Error,
		Warn,
		Neutral,
	}
}

