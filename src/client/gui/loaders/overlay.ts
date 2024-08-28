import { selected_curve } from "client/state/selected_curve";
import { selected_point } from "client/state/selected_point";
import { format_vector3, round } from "shared/util";
import { BezierCurveDisplay } from "client/curve";
import { Corner, CornerText } from "../components/CornerText";
import { Point } from "client/point";
import { RenderMillisecondTimings } from "shared/curve-rendering";
import { VisualColorDataSource } from "shared/curve-configuration";

const RunService = game.GetService("RunService");

const PADDING = UDim2.fromOffset(5, 5);

function format_timings(timings: RenderMillisecondTimings, curve: BezierCurveDisplay) {
	let out = "";
	if (curve.GetColorSource() !== VisualColorDataSource.None) {
		out += "Color: " + round(timings.Color.Evaluation, 2) + "ms (eval); " + round(timings.Color.Assignment, 2) + "ms (assign)";
	}
	out += "\nCompute:  " + round(timings.BezierComputation, 2) + "ms";
	out += "\nCFraming: " + round(timings.BulkMove, 2) + "ms";
	out += string.format("\n[%-5.2fms]; %.2fTPS", timings.Total, 1000 / timings.Total)
	return out;
}

const timing_statistics = new CornerText("Timing Statistics", Corner.BottomLeft, PADDING, "Loading...")
let render_connection: RBXScriptConnection | undefined = undefined
let render_timestamp = 0;
function watch_curve(curve: BezierCurveDisplay | undefined) {
	if (curve === undefined) return; // If deselected in the UI, connection is kept around.
	render_connection?.Disconnect();
	render_connection = curve?.OnRender.Connect((timings) => {
		render_timestamp = tick();
		timing_statistics.SetText(format_timings(timings, curve))
	})
}
selected_curve.Signal.Connect(watch_curve)
watch_curve(selected_curve.Get())
RunService.Heartbeat.Connect(() => {
	if (tick() - render_timestamp > 1) {
		timing_statistics.SetText((selected_curve.Get() !== undefined)
			? "Waiting for changes..."
			: "No curve selected!"
		);
	}
})

const selected_point_coordinates = new CornerText("Point Coordinates", Corner.BottomRight, PADDING, "Loading...");
let movement_connection: RBXScriptConnection | undefined = undefined;
function watch_point(point: Point | undefined) {
	movement_connection?.Disconnect();
	if (point) {
		selected_point_coordinates.SetText(format_vector3(point.Instance.Position))
		movement_connection = point.OnMovement.Connect((cframe) => selected_point_coordinates.SetText(format_vector3(cframe.Position)));
	}
}
selected_point.Signal.Connect((point) => watch_point(point))
watch_point(selected_point.Get())
