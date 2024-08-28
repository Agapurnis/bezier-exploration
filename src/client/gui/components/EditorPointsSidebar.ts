// import { BezierCurveDisplay } from "client/curve";
// import { selected_curve } from "client/state/selected_curve";
// import { make, round } from "shared/util";
// import { EditorPointsListItem } from "./EditorPointsListItem";
// import { EditorCurvesList } from "./EditorCurvesList";

// export class EditorPointsSidebar {
// 	private static readonly InstanceTemplate = make("Frame", {
// 		Size: new UDim2(0, 100, 1, 0),
// 		Children: {
// 			Top: make("Frame", {
// 				BackgroundColor3: new Color3(0.35, 0.35, 0.35),
// 				Children: {
// 					Label: make("TextLabel", {
// 						Text: "Curves"
// 					}),
// 				}
// 			}),
// 			Bottom: undefined as unknown as EditorCurvesList.Instance
// 		}
// 	})

// 	public readonly Instance: typeof EditorPointsSidebar.InstanceTemplate;

// 	constructor(public readonly Curve: BezierCurveDisplay) {
// 		this.Instance = EditorPointsSidebar.InstanceTemplate.Clone();
// 		this.Instance.MouseButton1Click.Connect(() => {
// 			selected_curve.Set(this.IsSelected() ? undefined : this.Curve);
// 		});

// 		let curve_update_connection: RBXScriptConnection | undefined
// 		const connection = selected_curve.Signal.Connect((new_curve) => {
// 			const is_selected = this.IsSelected();
// 			this.Update(is_selected);
// 			if (is_selected) {
// 				curve_update_connection?.Disconnect();
// 				curve_update_connection = undefined;
// 				if (new_curve) curve_update_connection = new_curve.OnRender.Connect(() => this.Update(true))
// 			}
// 		});

// 		this.Instance.Destroying.Connect(() => connection.Destroy())
// 		this.Update();
// 	}
// }

// export namespace EditorPointsSidebar {
// 	export type Instance = EditorPointsSidebar["Instance"]
// }
