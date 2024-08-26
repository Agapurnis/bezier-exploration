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
			TextLabel: make("TextLabel", {
				Position: UDim2.fromOffset(30, 0),
				Size: new UDim2(0.5, -30, 1, 0),
			}),
			ReorderButtons: make("Frame", {
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
			RightButtons: make("Frame", {
				Size: new UDim2(0.5, -30, 1, 0),
				Position: UDim2.fromScale(0.5, 0),
				Children: {
					Delete: make("TextButton", {
						Text: "Remove",
						Size: UDim2.fromScale(0.5, 1)
					}),
					Copy: make("TextButton", {
						Text: "Clone",
						Position: UDim2.fromScale(0.5, 0),
						Size: UDim2.fromScale(0.5, 1),
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
		this.Instance.TextLabel.Text = format_vector3(Point.Instance.Position);

		const janitor = new Janitor();
		janitor.Add(Point.OnMovement.Connect((cframe) => this.Instance.TextLabel.Text = format_vector3(cframe.Position)));
		janitor.Add(selected_point.Signal.Connect(() => this.StyleBasedOnIsActive()))
		this.Instance.Destroying.Once(() => janitor.Destroy())
		this.StyleBasedOnIsActive()

		this.Instance.ReorderButtons.Up.MouseButton1Click.Connect(() => this.AdjustOrderPlacement(-1))
		this.Instance.ReorderButtons.Down.MouseButton1Click.Connect(() => this.AdjustOrderPlacement(1))

		this.Instance.RightButtons.Copy.MouseButton1Click.Connect(() => Curve.AddPoint(get_character().GetPivot().Position, this.PointIndex))
		this.Instance.RightButtons.Delete.MouseButton1Click.Once(() => {
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
		this.Instance.TextLabel.BackgroundColor3 = (is_active)
			? new Color3(0.79, 0.76, 0.76)
			: new Color3(0.68, 0.68, 0.68)
	}
}

export namespace EditorPointsListItem {
	export type Instance = EditorPointsListItem["Instance"]
}
