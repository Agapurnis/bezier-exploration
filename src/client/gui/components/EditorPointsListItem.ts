import { Janitor } from "@rbxts/janitor";
import { BezierCurveDisplay } from "client/curve";
import { Point } from "client/point";
import { selected_point } from "client/state/selected_point";
import { get_character } from "client/util";
import { format_vector3, make } from "shared/util";

export class EditorPointsListItem {
	private static readonly InstanceTemplate = make("Frame", {
		Name: "EditorPointsListItem",
		Size: new UDim2(1, 0, 0, 30),
		Children: {
			Layout: make("UIListLayout", {
				SortOrder: Enum.SortOrder.LayoutOrder,
				FillDirection: Enum.FillDirection.Horizontal,
			}),
			ReorderButtons: make("Frame", {
				LayoutOrder: 0,
				Size: new UDim2(0, 30, 1, 0),
				Children: {
					Up: make("TextButton", {
						Size: UDim2.fromScale(1, 0.5),
						Text: "^",
					}),
					Down: make("TextButton", {
						Size: UDim2.fromScale(1, 0.5),
						Position: UDim2.fromScale(0, 0.5),
						Text: "v"
					})
				}
			}),
			Coordinates: make("TextLabel", {
				LayoutOrder: 1,
				Position: UDim2.fromOffset(30, 0),
				Size: new UDim2(0, 0, 1, 0),
				AutomaticSize: Enum.AutomaticSize.X,
				FontFace: Font.fromName(Enum.Font.RobotoMono.Name, Enum.FontWeight.Bold),
				TextScaled: true,
				TextXAlignment: Enum.TextXAlignment.Left,
				Children: {
					Pad: make("UIPadding", {
						PaddingLeft: new UDim(0, 5)
					}),
					Grow: make("UIFlexItem", {
						FlexMode: Enum.UIFlexMode.Fill
					}),
					Constrain: make("UITextSizeConstraint", {
						MaxTextSize: 14
					})
				}
			}),
			RightButtons: make("Frame", {
				LayoutOrder: 2,
				Size: new UDim2(0, 0, 1, 1),
				AutomaticSize: Enum.AutomaticSize.X,
				Position: UDim2.fromScale(0.5, 0),
				Children: {
					Delete: make("ImageButton", {
						Image: "http://www.roblox.com/asset/?id=11768918600",
						Size: new UDim2(0, 10e10, 1, 0),
						Children: {
							AspectRatio: new Instance("UIAspectRatioConstraint")
						}
					}),
					Copy: make("TextButton", {
						Text: "Clone",
						Position: new UDim2(0, 62, 0, 0),
						Size: new UDim2(0, -30, 1, 0)
					}),
				}
			})
		}
	})


	public readonly Instance: typeof EditorPointsListItem.InstanceTemplate;

	constructor(
		public readonly Point: Point,
		public readonly Curve: BezierCurveDisplay,
		private readonly PointIndex: number,
	) {
		this.Instance = EditorPointsListItem.InstanceTemplate.Clone();
		this.Instance.Coordinates.Text = format_vector3(Point.Instance.Position);

		const janitor = new Janitor();
		janitor.Add(Point.OnMovement.Connect((cframe) => this.Instance.Coordinates.Text = format_vector3(cframe.Position)));
		janitor.Add(selected_point.Signal.Connect(() => this.StyleBasedOnIsActive()))
		this.Instance.Destroying.Once(() => janitor.Destroy())
		this.StyleBasedOnIsActive()

		this.Instance.ReorderButtons.Up.MouseButton1Click.Connect(() => this.AdjustOrderPlacement(-1))
		this.Instance.ReorderButtons.Down.MouseButton1Click.Connect(() => this.AdjustOrderPlacement(1))

		this.Instance.RightButtons.Copy.MouseButton1Click.Connect(() => Curve.AddPoint(get_character().GetPivot().Position, this.PointIndex))
		this.Instance.RightButtons.Delete.MouseButton1Click.Connect(() => {
			const { ok, err } = Curve.RemovePoint(this.PointIndex)
			if (!ok) warn(err)
		});
	}

	public AdjustOrderPlacement(travel: number) {
		this.Curve.SwapPoints(
			this.PointIndex,
			this.PointIndex + travel
		)
	}

	public IsActive() {
		return this.Point === selected_point.Get();
	}

	private StyleBasedOnIsActive(is_active = this.IsActive()) {
		this.Instance.Coordinates.BackgroundColor3 = (is_active)
			? new Color3(0.79, 0.76, 0.76)
			: new Color3(0.68, 0.68, 0.68)
	}
}

export namespace EditorPointsListItem {
	export type Instance = EditorPointsListItem["Instance"]
}
