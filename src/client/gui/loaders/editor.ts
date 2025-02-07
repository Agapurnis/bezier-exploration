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
import { make, round } from "shared/util";
import { OutcomeDisplay } from "../components/OutcomeDisplay";
import { ComputationMethod, VisualColorDataSource } from "shared/curve-configuration";

const LogService = game.GetService("LogService");

export const editor = new Instance("Frame");
editor.Name = "Editor"
editor.Position = UDim2.fromScale(0.25, 0.25)
editor.Size = UDim2.fromScale(0.5, 0.5)
editor.Parent = screen;
editor.Visible = false;

const new_curve_button = new Instance("TextButton");
new_curve_button.Name = "Add New Curve"
new_curve_button.Text = "Add New Curve"
new_curve_button.BackgroundColor3 = new Color3(0.8, 0.8, 0.8)
new_curve_button.Size = UDim2.fromScale(0.2, 0.15);
new_curve_button.Parent = editor;
new_curve_button.MouseButton1Click.Connect(() => {
	const basis = game.Workspace.CurrentCamera!.CFrame.Rotation.add(get_character().GetPivot().Position)
	curves.AddCurve(new BezierCurveDisplay([
		basis.mul(new Vector3( -5, 3, -10)).Max(new Vector3(-9e9, 3, -9e9)),
		basis.mul(new Vector3(  0, 7, -10)).Max(new Vector3(-9e9, 3, -9e9)),
		basis.mul(new Vector3(  5, 3, -10)).Max(new Vector3(-9e9, 3, -9e9)),
	]))
})

new EditorCurvesList(editor)
new EditorPointsList(editor)

export const outcome_display = new OutcomeDisplay(editor);
let reading_stack = false;
function handle_message(message: string, category: Enum.MessageType) {
	if (category === Enum.MessageType.MessageInfo) {
		if (message === "Stack End") { reading_stack = false; return }
		reading_stack ||= (message === "Stack Begin");
		if (reading_stack) return;
	}
	if (category === Enum.MessageType.MessageError) {
		const [, source_terminator] = message.find(":%d+: ");
		if (source_terminator !== undefined) message = message.sub(source_terminator)
	}
	outcome_display.Put(OutcomeDisplay.GetColor(category), message, 3)
}
LogService.MessageOut.Connect((message, category) => handle_message(message, category));
function display_error(text: string): void { handle_message(text, Enum.MessageType.MessageError) }

const offset_five = new UDim(0, 5);
export const curve_settings_frame = make("ScrollingFrame", {
	Name: "Curve Settings",
	Position: UDim2.fromScale(0.8, 0),
	Size: UDim2.fromScale(0.20, 1),
	Parent: editor,
	BackgroundColor3: new Color3(0.49, 0.49, 0.49),
	AutomaticCanvasSize: Enum.AutomaticSize.Y,
	VerticalScrollBarInset: Enum.ScrollBarInset.ScrollBar,
	Children: {
		Padding: make("UIPadding", {
			PaddingTop: offset_five,
			PaddingBottom: offset_five,
			PaddingLeft: offset_five,
			PaddingRight: offset_five,
		}),
		Layout: make("UIListLayout", {
			SortOrder: Enum.SortOrder.LayoutOrder,
			Padding: new UDim(0, 5),
			HorizontalAlignment: Enum.HorizontalAlignment.Center,
		}),
	}
})

const resolution_frame = new ButtonLabelledTextInput("Resolution", "Set Resolution", undefined, curve_settings_frame, (value) => {
	const num = tonumber(value)
	if (num === undefined) return display_error("The provided resolution is not a valid number")
	const curve = selected_curve.Get()!;
	curve.Modify((b) => b.WithResolution(num))
	curve.Render();
})

const part_transparency = new ButtonLabelledTextInput("Transparency", "Part Transparency", undefined, curve_settings_frame, (value) => {
	const num = tonumber(value);
	if (num === undefined) return display_error("The provided transparency value is not a valid number.")
	const curve = selected_curve.Get()!;
	curve.PathInstanceTemplate.Transparency = num;
	curve.Repool();
	curve.Render();
})


const threads = new ButtonLabelledTextInput("Threads", "Threads", undefined, curve_settings_frame, (value) => {
	const num = tonumber(value);
	if (num === undefined) return display_error("The provided thread count is not a valid number.")
	const curve = selected_curve.Get()!;
	curve.Modify((b) => b.WithThreads(num))
	curve.Render();
})


// TODO: make trace behavior in curve class
new ButtonLabelledTextInput("Trace", "Trace (seconds)", "1", curve_settings_frame, (value) => {
	const input_seconds = tonumber(value);
	if (input_seconds === undefined) return display_error("That trace time is not a valid number.")
	selected_curve.Get()!.Trace(input_seconds);
})


const size_toggle = new LabelledCheckbox("Fit w/ Size", undefined, false, curve_settings_frame, (checked) => {
	const curve = selected_curve.Get()!;
	curve!.Modify((b) => b.WithSize(checked))
	curve.Repool();
	curve.Render();
	refresh_curve_settings();
	outcome_display.Clear();
})


const color_source_option = new CyclableOptionsInput("Color", undefined, [
	VisualColorDataSource.Velocity,
	VisualColorDataSource.Direction,
	VisualColorDataSource.Curvature,
	// VisualColorDataSource.Acceleration,
	VisualColorDataSource.Random,
	VisualColorDataSource.None,
], undefined, undefined, curve_settings_frame, (source) => {
	const curve = selected_curve.Get()!;
	curve.Modify((b) => b.WithColorSource(source))
	curve.Render();
	refresh_curve_settings();
	outcome_display.Clear();
})

const shape_option = new CyclableOptionsInput("Shape", undefined, [
	Enum.PartType.Block,
	Enum.PartType.Cylinder,
	Enum.PartType.Ball,
	Enum.PartType.Wedge
], (variant) => variant.Name, undefined, curve_settings_frame, (shape) => {
	selected_curve.Get()!.ApplyPhysicalModification((part) => {
		part.Shape = shape;
	})
})

const method_option = new CyclableOptionsInput("Method", undefined, [
	ComputationMethod.Polynomic,
	ComputationMethod.PolynomicHorners,
	ComputationMethod.DeCasteljau,
], undefined, undefined, curve_settings_frame, (method) => {
	const curve = selected_curve.Get()!;
	curve.Modify((b) => b.WithMethod(method))
	curve.Render()
	refresh_curve_settings();
	outcome_display.Clear();
})



const csf_acs = curve_settings_frame.Layout.AbsoluteContentSize;
const csf_p = curve_settings_frame.Padding;
curve_settings_frame.CanvasSize = new UDim2(
	0, csf_acs.X + csf_p.PaddingLeft  .Offset + csf_p.PaddingRight.Offset,
	0, csf_acs.Y + csf_p.PaddingBottom.Offset + csf_p.PaddingTop  .Offset
);


export const editor_general_settings = new Instance("ScrollingFrame");
editor_general_settings.Name = "General Settings"
editor_general_settings.Position = curve_settings_frame.Position
editor_general_settings.Size = curve_settings_frame.Size
editor_general_settings.Visible = false;
editor_general_settings.Parent = editor;
new Instance("UIListLayout", editor_general_settings).SortOrder = Enum.SortOrder.LayoutOrder;


const sound_toggle = new LabelledCheckbox("Sound Effects", "SFX Toggle", true, editor_general_settings, (checked) => {
	use_sound_effects.Set(checked)
})


function update_editor_curve_settings(curve: BezierCurveDisplay | undefined) {
	curve_settings_frame.Visible = (curve !== undefined);
	editor_general_settings.Visible = (curve === undefined);
	if (curve) {
		resolution_frame.SetContent(tostring(curve.GetResolution()))
		part_transparency.SetContent(tostring(round(curve.PathInstanceTemplate.Transparency, 3)));
		size_toggle.Set(curve.GetSize())
		color_source_option.SetCurrent(curve.GetColorSource())
		shape_option.SetCurrent(curve.PathInstanceTemplate.Shape as Exclude<Enum.PartType, Enum.PartType.CornerWedge>)
		method_option.SetCurrent(curve.GetMethod())
		threads.SetContent(tostring(curve.GetThreads()))
	}
}
function refresh_curve_settings() {
	update_editor_curve_settings(selected_curve.Get())
}
selected_curve.Signal.Connect((curve) => update_editor_curve_settings(curve))
refresh_curve_settings()


