import { BezierCurveDisplay } from "client/curve";
import { screen } from "../util";
import { LabelledCheckbox } from "../components/LabelledCheckbox";
import { use_sound_effects } from "client/state/sfx";
import { CyclableOptionsInput } from "../components/CyclableOptionsInput";
import { get_character } from "client/util";
import { curves } from "client/state/curves";
import { EditorCurvesList } from "../components/EditorCurvesList";
import { EditorPointsList } from "../components/EditorPointsList";
import { ButtonLabelledTextInput } from "../components/ButtonLabelledTextInput";
import { selected_curve } from "client/state/selected_curve";
import { Janitor } from "@rbxts/janitor";
import { bezier } from "shared/bezier";
import { round } from "shared/util";

const RunService = game.GetService("RunService");

export const editor = new Instance("Frame");
editor.Name = "Editor"
editor.Position = UDim2.fromScale(0.25, 0.25)
editor.Size = UDim2.fromScale(0.5, 0.5)
editor.Parent = screen;
editor.Visible = false;

const editor_add_new_curve_button = new Instance("TextButton");
editor_add_new_curve_button.Name = "Add New Curve"
editor_add_new_curve_button.Text = "Add New Curve"
editor_add_new_curve_button.BackgroundColor3 = new Color3(0.8, 0.8, 0.8)
editor_add_new_curve_button.Size = UDim2.fromScale(0.2, 0.15);
editor_add_new_curve_button.Parent = editor;
editor_add_new_curve_button.MouseButton1Click.Connect(() => {
	const basis = game.Workspace.CurrentCamera!.CFrame.Rotation.add(get_character().GetPivot().Position)
	curves.AddCurve(new BezierCurveDisplay([
		basis.mul(new Vector3( -5, 3, -10)).Max(new Vector3(-9e9, 3, -9e9)),
		basis.mul(new Vector3(  0, 7, -10)).Max(new Vector3(-9e9, 3, -9e9)),
		basis.mul(new Vector3(  5, 3, -10)).Max(new Vector3(-9e9, 3, -9e9)),
	]))
})


new EditorCurvesList(editor)
new EditorPointsList(editor)

export const editor_curve_settings = new Instance("ScrollingFrame");
editor_curve_settings.Name = "Curve Settings"
editor_curve_settings.Position = UDim2.fromScale(0.8, 0)
editor_curve_settings.Size = UDim2.fromScale(0.20, 1);
editor_curve_settings.Parent = editor;
new Instance("UIListLayout", editor_curve_settings).SortOrder = Enum.SortOrder.LayoutOrder;


const resolution_frame = new ButtonLabelledTextInput("Resolution", "Set Resolution", undefined, editor_curve_settings, (value) => {
	const num = tonumber(value)
	if (num === undefined) return warn("can't convert resolution to number");
	const curve = selected_curve.Get()!;
	curve.SetResolution(math.round(num));
	curve.Render();
})

const part_transparency = new ButtonLabelledTextInput("Transparency", "Part Transparency", undefined, editor_curve_settings, (value) => {
	const num = tonumber(value);
	if (num === undefined) return warn("can't convert transparency to number");
	const curve = selected_curve.Get()!;
	curve.PathInstanceTemplate.Transparency = num;
	curve.Repool();
	curve.Render();
})

const trace = new ButtonLabelledTextInput("Trace", "Trace (seconds)", undefined, editor_curve_settings, (value) => {
	const input_seconds = tonumber(value);
	if (input_seconds === undefined) return warn("can't convert time to number");
	const tracer = new Instance("Part");
	tracer.Name = "Trace"
	tracer.Parent = game.Workspace;
	tracer.Material = Enum.Material.SmoothPlastic;
	tracer.Anchored = true;
	tracer.Size = Vector3.one.mul(1.5)
	const curve = selected_curve.Get()!;
	let positions = curve.GetPointPositions();
	let elapsed = 0;
	const janitor = new Janitor();
	janitor.Add(tracer.Destroying.Connect(() => janitor.Destroy()))
	janitor.Add(curve.OnDestroy.Connect(() => janitor.Destroy())) // might run into race condition in heartbeat?
	janitor.Add(curve.OnUpdate.Connect(() => positions = curve.GetPointPositions()))
	janitor.Add(RunService.Heartbeat.Connect((delta) => {
		const progress = (elapsed / input_seconds)
		if (progress > 1) return tracer.Destroy();
		const position = bezier(positions, progress);
		const velocity = bezier(positions, progress, 1)
		tracer.CFrame = CFrame.lookAlong(position, velocity).mul(curve.OrientationBasis);
		elapsed += delta;
	}));
})




const size_toggle = new LabelledCheckbox("Fit w/ Size", undefined, false, editor_curve_settings, (checked) => {
	const curve = selected_curve.Get()!;
	curve!.UseSize = checked;
	curve.Repool();
	curve.Render();
})


const style_option = new CyclableOptionsInput("Style", undefined, [
	BezierCurveDisplay.VisualColorDataSource.Velocity,
	BezierCurveDisplay.VisualColorDataSource.Direction,
	BezierCurveDisplay.VisualColorDataSource.Curvature,
	BezierCurveDisplay.VisualColorDataSource.Random,
	BezierCurveDisplay.VisualColorDataSource.None,
], undefined, undefined, editor_curve_settings, (style) => {
	const curve = selected_curve.Get()!;
	curve.SetStyle(style)
	curve.Render();
})

const shape_option = new CyclableOptionsInput("Shape", undefined, [
	Enum.PartType.Block,
	Enum.PartType.Cylinder,
	Enum.PartType.Ball,
	Enum.PartType.Wedge
], (variant) => variant.Name, undefined, editor_curve_settings, (shape) => {
	selected_curve.Get()!.ApplyPhysicalModification((part) => {
		part.Shape = shape;
	})
})


export const editor_general_settings = new Instance("ScrollingFrame");
editor_general_settings.Name = "General Settings"
editor_general_settings.Position = editor_curve_settings.Position
editor_general_settings.Size = editor_curve_settings.Size
editor_general_settings.Visible = false;
editor_general_settings.Parent = editor;
new Instance("UIListLayout", editor_general_settings).SortOrder = Enum.SortOrder.LayoutOrder;


const sound_toggle = new LabelledCheckbox("Sound Effects", "SFX Toggle", true, editor_general_settings, (checked) => {
	use_sound_effects.Set(checked)
})


function update_editor_curve_settings(curve: BezierCurveDisplay | undefined) {
	editor_curve_settings.Visible = (curve !== undefined);
	editor_general_settings.Visible = (curve === undefined);
	if (curve) {
		resolution_frame.SetContent(tostring(curve.GetResolution()))
		part_transparency.SetContent(tostring(round(curve.PathInstanceTemplate.Transparency, 3)));
		size_toggle.Set(curve.UseSize)
		style_option.SetCurrent(curve.GetStyle())
		shape_option.SetCurrent(curve.PathInstanceTemplate.Shape as Exclude<Enum.PartType, Enum.PartType.CornerWedge>)
		trace.SetContent("1")
	}
}
selected_curve.Signal.Connect((curve) => update_editor_curve_settings(curve))
update_editor_curve_settings(selected_curve.Get())



