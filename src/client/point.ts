const player = game.GetService("Players").LocalPlayer;
const player_gui = player.WaitForChild("PlayerGui") as PlayerGui;

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
		drag.MaxActivationDistance = 1_000
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
		DragDetector: DragDetector
	}
	export const enum Appearance {
		Control,
		Terminal
	}
}

