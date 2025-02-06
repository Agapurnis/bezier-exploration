import { selected_point } from "./state/selected_point";

const player = game.GetService("Players").LocalPlayer;
const player_gui = player.WaitForChild("PlayerGui") as PlayerGui;

const TweenService = game.GetService("TweenService");

const WHITE = new Color3(1, 1, 1)

interface HighlightTransitionDetails {
	TweenInfo: TweenInfo,
	Properties: Pick<Highlight,
		| "OutlineTransparency"
		|    "FillTransparency"
	>;
}

export class Point {
	private static readonly Template = new Instance("Part") as Point.Instance;
	static {
		this.Template.AddTag("Point")
		this.Template.Transparency = 0.5
		this.Template.Material = Enum.Material.SmoothPlastic;
		this.Template.Anchored = true;
		this.Template.CanCollide = false;
		new Instance("Attachment", this.Template)
		const beam = new Instance("Beam", this.Template);
		beam.Texture = "http://www.roblox.com/asset/?id=12829309313"
		beam.TextureMode = Enum.TextureMode.Wrap;
		beam.TextureSpeed = 0;
		beam.FaceCamera = true;
		const drag = new Instance("DragDetector", this.Template);
		drag.RunLocally = true;
		drag.DragStyle = Enum.DragDetectorDragStyle.BestForDevice;
		drag.MaxActivationDistance = 1_000;
		const highlight = new Instance("Highlight", this.Template);
		highlight.FillColor = WHITE;
		highlight.FillTransparency = 1
		highlight.OutlineColor = WHITE;
		highlight.OutlineTransparency = 1
	}

	public static TestInstance(value: unknown): value is Point.Instance {
		return typeIs(value, "Instance") && value.HasTag("Point")
	}

	private static readonly InstanceToClassMapping = new WeakMap<Point.Instance, Point>();
	public static GetPointFromInstance(instance: Point.Instance): Point {
		return this.InstanceToClassMapping.get(instance)!
	}

	private readonly OnMovementBindable: BindableEvent<(position: CFrame) => void> = new Instance("BindableEvent");
	public readonly OnMovement = this.OnMovementBindable.Event
	public readonly Instance: Point.Instance;

	public IsSelected() {
		return selected_point.Get() === this;
	}

	private Held = false;
	private Hovered = false;
	private HighlightTween?: Tween | undefined;
	public TweenHighlight(details = this.EvaluateHighlightTransitionTarget()) {
		this.HighlightTween?.Destroy()
		this.HighlightTween = TweenService.Create(this.Instance.Highlight, details.TweenInfo, details.Properties)
		this.HighlightTween.Completed.Once(() => this.HighlightTween?.Destroy())
		this.HighlightTween.Play();
	}
	public AdjustHighlight(state_adjustment: Point.StateHighlightModifier, state: boolean) {
		if (state_adjustment === Point.StateHighlightModifier.Held) { if (this.Held === state) return; this.Held = state; }
		if (state_adjustment === Point.StateHighlightModifier.Hover) { if (this.Hovered === state) return; this.Hovered = state; }
		this.TweenHighlight()
	}

	private EvaluateHighlightTransitionTarget(): HighlightTransitionDetails {
		// FIXME
		return HighlightConfigurations.INVISIBLE

		// if (!this.IsSelected()) {
		// 	if (this.Held) error("Bad state!")
		// 	if (this.Hovered) return HighlightConfigurations.HOVERED_NON_SELECTED;
		// 	return HighlightConfigurations.INVISIBLE
		// } else {
		// 	if (this.Held) return HighlightConfigurations.SELECTED_HELD
		// 	if (this.Hovered) return HighlightConfigurations.SELECTED_HOVERED
		// 	return HighlightConfigurations.SELECTED
		// }
	}

	constructor (
		position: Vector3,
		appearance: Point.Appearance,
		parent: Instance
	) {
		this.Instance = Point.Template.Clone();
		Point.InstanceToClassMapping.set(this.Instance, this);
		this.Instance.Beam.Attachment0 = this.Instance.Attachment;
		this.Instance.DragDetector.DragContinue.Connect(() => this.OnMovementBindable.Fire(this.Instance.CFrame))
		this.UpdateStyle(appearance);
		this.Instance.Position = position;
		this.Instance.Parent = parent;
	}

	public UpdateStyle(style: Point.Appearance): void {
		switch (style) {
			case Point.Appearance.Control: {
				this.Instance.Color = BrickColor.Blue().Color;
				this.Instance.Shape = Enum.PartType.Ball
				this.Instance.Size = new Vector3(2, 2, 2);
				return
			}
			case Point.Appearance.Terminal: {
				this.Instance.Color = BrickColor.Red().Color;
				this.Instance.Shape = Enum.PartType.Block;
				this.Instance.Size = new Vector3(2.5, 2.5, 2.5)
				return
			}
		}
	}

	private Handles: Handles | undefined
	public GetHandles(): Handles | undefined { return this.Handles }

	public AddHandles(): Handles {
		const handles = new Instance("Handles");
		let origin: CFrame;
		handles.MouseButton1Down.Connect(() => origin = this.Instance.CFrame);
		handles.MouseDrag.Connect((face, distance) => {
			switch (face) {
				case Enum.NormalId.Top:
				case Enum.NormalId.Bottom: {
					const direction = (face === Enum.NormalId.Top) ? 1 : -1;
					this.Instance.CFrame = origin.add(this.Instance.CFrame.UpVector.mul(distance * direction));
					break
				}
				case Enum.NormalId.Front:
				case Enum.NormalId.Back: {
					const direction = (face === Enum.NormalId.Front) ? 1 : -1;
					this.Instance.CFrame = origin.add(this.Instance.CFrame.LookVector.mul(distance * direction))
					break
				}
				case Enum.NormalId.Right:
				case Enum.NormalId.Left: {
					const direction = (face === Enum.NormalId.Right) ? 1 : -1;
					this.Instance.CFrame = origin.add(this.Instance.CFrame.RightVector.mul(distance * direction))
					break
				}
			}
			this.OnMovementBindable.Fire(this.Instance.CFrame)
		})
		handles.Adornee = this.Instance;
		handles.Parent = player_gui;
		this.Handles = handles
		return handles
	}

	public RemoveHandles() {
		this.Handles?.Destroy();
		this.Handles = undefined;
	}

	public Destroy() {
		this.OnMovementBindable.Destroy();
		this.Instance.Destroy();
		this.Handles?.Destroy();
	}
}

export namespace Point {
	export interface Instance extends Part {
		Attachment: Attachment,
		Beam: Beam,
		DragDetector: DragDetector,
		Highlight: Highlight
	}
	export const enum Appearance {
		Control,
		Terminal
	}
	export const enum StateHighlightModifier {
		Hover = "Hover",
		Held = "Held",
	}
}

namespace HighlightConfigurations {
	export const INVISIBLE: HighlightTransitionDetails = {
		TweenInfo: new TweenInfo(.1),
		Properties: {
			OutlineTransparency: 1,
			FillTransparency: 1
		}
	}
	export const HOVERED_NON_SELECTED: HighlightTransitionDetails = {
		TweenInfo: new TweenInfo(.1),
		Properties: {
			OutlineTransparency: .9,
			FillTransparency: .9
		}
	}
	export const SELECTED: HighlightTransitionDetails = {
		TweenInfo: new TweenInfo(.1),
		Properties: {
			OutlineTransparency: .85,
			FillTransparency: .85
		}
	}
	export const SELECTED_HOVERED: HighlightTransitionDetails = {
		TweenInfo: new TweenInfo(.1),
		Properties: {
			OutlineTransparency: .775,
			FillTransparency: .775
		}
	}
	export const SELECTED_HELD: HighlightTransitionDetails = {
		TweenInfo: new TweenInfo(.1),
		Properties: {
			OutlineTransparency: .65,
			FillTransparency: .65
		}
	}
}
