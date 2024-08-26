import { BezierCurveDisplay } from "client/curve";
import { selected_curve } from "client/state/selected_curve";
import { make, round } from "shared/util";

export class EditorCurvesListItem {
	private static readonly InstanceTemplate = make("TextButton", {
		Name: "EditorCurvesListItem",
		Size: new UDim2(1, 0, 0, 30)
	})

	public IsSelected() {
		return selected_curve.Get() === this.Curve
	}

	private Update(is_selected = this.IsSelected()) {
		const length = tostring(round(this.Curve.GetLength(), 2)) + "studs"
		this.Instance.Text = (is_selected)
			? "✅ " + length
			:         length
	}

	public readonly Instance: typeof EditorCurvesListItem.InstanceTemplate;

	constructor(public readonly Curve: BezierCurveDisplay) {
		this.Instance = EditorCurvesListItem.InstanceTemplate.Clone();
		this.Instance.MouseButton1Click.Connect(() => {
			selected_curve.Set(this.IsSelected() ? undefined : this.Curve);
		});

		let curve_update_connection: RBXScriptConnection | undefined
		const connection = selected_curve.Signal.Connect((new_curve) => {
			const is_selected = this.IsSelected();
			this.Update(is_selected);
			if (is_selected) {
				curve_update_connection?.Disconnect();
				curve_update_connection = undefined;
				if (new_curve) curve_update_connection = new_curve.OnRender.Connect(() => this.Update(true))
			}
		});

		this.Instance.Destroying.Connect(() => connection.Destroy())
		this.Update();
	}
}

export namespace EditorPointsListItem {
	export type Instance = EditorCurvesListItem["Instance"]
}
