import { selected_curve } from "client/state/selected_curve";
import { selected_point } from "client/state/selected_point";
import { format_vector3, round } from "shared/util";
import { BezierCurveDisplay } from "client/curve";
import { Corner, CornerText } from "../components/CornerText";
import { Point } from "client/point";
import { screen } from "../util";
import { get_character } from "client/util";

const RunService = game.GetService("RunService");

const PADDING = UDim2.fromOffset(5, 5);

function format_timings(timings: BezierCurveDisplay.RenderTimings) {
	return (timings.Detail === "Complex")
		? (
			"Compute: " + round(timings.Computation, 2) + "ms" + "\n" +
			"Total: " + round(timings.Total, 2) + "ms"
		)
		: round(timings.Total, 2) + "ms"
}

const timing_statistics = new CornerText("Timing Statistics", Corner.BottomLeft, PADDING, "Loading...")
let render_connection: RBXScriptConnection | undefined = undefined
let render_timestamp = 0;
function watch_curve(curve: BezierCurveDisplay | undefined) {
	render_connection?.Disconnect();
	render_connection = curve?.OnRender.Connect((timings) => {
		render_timestamp = tick();
		timing_statistics.SetText(format_timings(timings))
	})
}
selected_curve.Signal.Connect((curve) => watch_curve(curve));
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
