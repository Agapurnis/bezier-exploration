import { BezierCurveDisplay } from "client/curve";
import { Point } from "client/point";
import { make } from "shared/util";
import { EditorPointsListItem } from "./EditorPointsListItem";
import { selected_curve } from "client/state/selected_curve";

export class EditorPointsList {
	private static readonly InstanceTemplate = make("ScrollingFrame", {
		Name: "Points List",
		Position: UDim2.fromScale(0.2, 0),
		Size: UDim2.fromScale(0.6, 1),
	})

	public Update(curve: BezierCurveDisplay, points?: ReadonlyArray<Point> | undefined): void
	public Update(curve: undefined, points?: undefined): void
	public Update(curve: BezierCurveDisplay | undefined): void
	public Update(curve: BezierCurveDisplay | undefined, points?: ReadonlyArray<Point>) {
		this.Instance.ClearAllChildren();
		if (!curve) return;
		new Instance("UIListLayout", this.Instance);
		(points ?? curve.GetPoints()).forEach((point, index) => {
			new EditorPointsListItem(point, curve, index).Instance.Parent = this.Instance;
		})
	}

	public readonly Instance: typeof EditorPointsList.InstanceTemplate;

	constructor(parent: GuiBase | undefined) {
		this.Instance = EditorPointsList.InstanceTemplate.Clone();
		let watching_curve_points_change: RBXScriptConnection | undefined
		const curve_change_connection = selected_curve.Signal.Connect((curve) => {
			this.Update(curve);
			watching_curve_points_change?.Disconnect();
			watching_curve_points_change = curve?.OnPointsChange.Connect((points) => {
				this.Update(curve, points)
			})
		});

		this.Instance.Destroying.Once(() => {
			watching_curve_points_change?.Disconnect();
			curve_change_connection.Disconnect()
		});
		this.Instance.Parent = parent;
	}
}

export namespace EditorPointsList {
	export type Instance = EditorPointsList["Instance"]
}
