import { active_point, BezierCurveDisplay, use_sound_effects } from "./curve";
import { curves } from "./state";
import { format_vector3, round } from "shared/util";
import { get_character, SubscribableRememberingStore } from "./util";
import { Icon } from "@rbxts/topbar-plus";
import { Janitor } from "@rbxts/janitor";
import { bezier } from "shared/bezier";
import { Point } from "./point";

const player = game.GetService("Players").LocalPlayer;
const player_gui = player.WaitForChild("PlayerGui") as PlayerGui;
const screen = new Instance("ScreenGui", player_gui);
screen.ResetOnSpawn = false;


const RunService = game.GetService("RunService");

type PartialWritableInstanceProperties<T extends Instance> = Partial<WritableInstanceProperties<T>>

function mk<
	const T extends keyof CreatableInstances,
	const U extends Record<string, Instance> | undefined
>(variant: T, properties:
	& PartialWritableInstanceProperties<CreatableInstances[T]>
	& { Children?: U & { [K in Extract<keyof U, keyof CreatableInstances[T]>]: K extends keyof CreatableInstances[T] ? { ERR: "This name overlaps with an instance property or method!" } : unknown }}
): CreatableInstances[T] & (U extends undefined ? unknown : U) {
	const instance = new Instance(variant);
	// eslint-disable-next-line roblox-ts/no-array-pairs
	for (const [property, value] of pairs(properties)) {
		if (property === "Children") continue;
		instance[property as unknown as never] = value as never;
	}
	// eslint-disable-next-line roblox-ts/no-array-pairs
	if (properties.Children !== undefined) for (const [name, child] of pairs(properties.Children)) {
		if ((child as Instance).Name === (child as Instance).ClassName) {
			(child as Instance).Name = name as string;
		}
		(child as Instance).Parent = instance;
	}
	return instance as CreatableInstances[T] & (U extends undefined ? unknown : U)
}

function Component<T extends GuiBase, U extends unknown[]>(make_template: () => T, make: (instance: T, ...context: U) => unknown): (...context: U) => T {
	const template = make_template();
	return (...context) => {
		const instance = template.Clone();
		make(instance, ...context)
		return instance
	}
}

const CornerText = Component(() => {
	const label = new Instance("TextLabel");
	label.Size = UDim2.fromOffset(200, 30)
	label.TextSize = 9;
	label.TextStrokeColor3 = new Color3(1, 1, 1);
	label.TextStrokeTransparency = 0.85;
	label.BackgroundTransparency = 1;
	return label
}, (label, name: string, corner: Enum.StartCorner, padding: number, text: string, parent: GuiBase = screen) => {
	const top  = (corner === Enum.StartCorner.TopLeft || corner === Enum.StartCorner.TopRight)
	const left = (corner === Enum.StartCorner.TopLeft || corner === Enum.StartCorner.BottomLeft)
	label.Name = name;
	label.Position = new UDim2(
		left ? 0 : 1,
		(left ? padding : -(label.Size.X.Offset + padding)),
		top ? 0 : 1,
		(top ? padding : -(label.Size.Y.Offset + padding))
	);
	label.TextXAlignment = left ? Enum.TextXAlignment.Left : Enum.TextXAlignment.Right;
	label.TextYAlignment =  top ? Enum.TextYAlignment.Top  : Enum.TextYAlignment.Bottom;
	label.Text = text;
	label.Parent = parent;
});

export const selected_curve = new SubscribableRememberingStore<BezierCurveDisplay | undefined>(undefined);
active_point.Signal.Connect((point) => selected_curve.Set(point ? BezierCurveDisplay.GetFromInstance(point.Instance.Parent!.Parent as BezierCurveDisplay.Instance) : undefined))

const statistics = CornerText("", Enum.StartCorner.BottomLeft, 5, "Loading...")
const coordinates = CornerText("Coordinates", Enum.StartCorner.BottomRight, 5, "Loading...");

let render_watch: RBXScriptConnection | undefined = undefined
let last_rendered_at = 0;
selected_curve.Signal.Connect((curve) => {
	render_watch?.Disconnect();
	if (curve) render_watch = curve.OnRender.Connect((timings) => {
		last_rendered_at = tick();
		statistics.Text = (timings.Detail === "Complex")
			? (
				"Compute: " + round(timings.Computation, 2) + "ms" + "\n" +
				"Total: " + round(timings.Total, 2) + "ms"
			)
			: round(timings.Total, 2) + "ms"
	})
});
RunService.Heartbeat.Connect(() => {
	coordinates.Text = format_vector3(get_character().GetPivot().Position)
	if (tick() - last_rendered_at > 1) statistics.Text = "Waiting for changes...";
})


export const editor = new Instance("Frame");
editor.Name = "Editor"
editor.Position = UDim2.fromScale(0.25, 0.25)
editor.Size = UDim2.fromScale(0.5, 0.5)
editor.Parent = screen;
editor.Visible = false;

new Icon()
	.setImage("http://www.roblox.com/asset/?id=8382597378")
	.setLabel("Menu")
	.align("Left")
	.bindToggleKey(Enum.KeyCode.E)
	.bindEvent("toggled", () => {
		editor.Visible = !editor.Visible;
		const curve = selected_curve.Get();
		if (curve) curve.Instance.Highlight.Enabled = editor.Visible;
	})

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

const editor_curves_list = new Instance("ScrollingFrame");
editor_curves_list.Name = "Curves List"
editor_curves_list.Size = UDim2.fromScale(0.2, 0.85);
editor_curves_list.Position = UDim2.fromScale(0, 0.15)
editor_curves_list.Parent = editor;

const EditorCurvesListItem = Component(() => {
	const item = new Instance("TextButton")
	item.Name = "EditorCurvesListItem"
	item.Size = new UDim2(1, 0, 0, 30);
	return item
}, (item, curve: BezierCurveDisplay) => {
	function update(selected = selected_curve.Get() === curve) {
		const length = tostring(round(curve.GetLength(), 2)) + "studs"
		item.Text = selected
			? "✅ " + length
			:         length
	}

	update()

	item.MouseButton1Click.Connect(() => {
		const active = selected_curve.Get() !== curve;
		selected_curve.Set(active ? curve : undefined);
	});
	let curve_update_connection: RBXScriptConnection | undefined
	const connection = selected_curve.Signal.Connect((new_curve) => {
		const is_active = new_curve === curve
		update(is_active);
		if (is_active) {
			curve_update_connection?.Disconnect();
			curve_update_connection = undefined;
			if (new_curve) curve_update_connection = new_curve.OnRender.Connect(() => update(true))
		}
	});

	item.Destroying.Connect(() => connection.Destroy())
});

function update_editor_curves_list(curves: ReadonlyArray<BezierCurveDisplay>) {
	editor_curves_list.ClearAllChildren();
	new Instance("UIListLayout", editor_curves_list);
	for (const curve of curves) {
		EditorCurvesListItem(curve).Parent = editor_curves_list;
	}
}

curves.OnCurvesListChange.Connect((curves) => update_editor_curves_list(curves))
update_editor_curves_list(curves.GetCurves())

export const editor_points_list = new Instance("ScrollingFrame");
editor_points_list.Name = "Points List"
editor_points_list.Position = UDim2.fromScale(editor_curves_list.Size.X.Scale, 0);
editor_points_list.Size = UDim2.fromScale(0.6, 1);
editor_points_list.Parent = editor;

function refresh_points_list(curve: BezierCurveDisplay | undefined) {
	editor_points_list.ClearAllChildren();
	if (!curve) return;
	new Instance("UIListLayout", editor_points_list);
	curve.GetPoints().forEach((point, index) => {
		const item = EditorPointsListItem(point, curve, index);
		item.Parent = editor_points_list;
	})
}

let watching_curve_points_change: RBXScriptConnection | undefined
selected_curve.Signal.Connect((curve, old) => {
	refresh_points_list(curve);
	if (old) old.Instance.Highlight.Enabled = false;
	watching_curve_points_change?.Disconnect()
	if (curve && editor.Visible) {
		curve.Instance.Highlight.Enabled = true;
		watching_curve_points_change = curve.OnPointsChange.Connect(() => refresh_points_list(curve));
	}
});



const EditorPointsListItem = Component(() => {
	return mk("Frame", {
		Name: "EditorPointsListItem",
		Size: new UDim2(1, 0, 0, 30),
		Children: {
			TextLabel: mk("TextLabel", {
				Position: UDim2.fromOffset(30, 0),
				Size: new UDim2(0.5, -30, 1, 0),
			}),
			ReorderButtons: mk("Frame", {
				Size: new UDim2(0, 30, 1, 0),
				Children: {
					Up: mk("TextButton", {
						Size: UDim2.fromScale(1, 0.5),
						Text: "^",
					}),
					Down: mk("TextButton", {
						Size: UDim2.fromScale(1, 0.5),
						Position: UDim2.fromScale(0, 0.5),
						Text: "v"
					})
				}
			}),
			RightButtons: mk("Frame", {
				Size: new UDim2(0.5, -30, 1, 0),
				Position: new UDim2(0.5, 0, 0, 0),
				Children: {
					Delete: mk("TextButton", {
						Text: "Remove",
						Size: UDim2.fromScale(0.5, 1)
					}),
					Copy: mk("TextButton", {
						Text: "Clone",
						Position: UDim2.fromScale(0.5, 0),
						Size: UDim2.fromScale(0.5, 1),
					}),
				}
			})
		}
	})
}, (item, point: Point, curve: BezierCurveDisplay, index: number) => {
	item.TextLabel.Text = format_vector3(point.Instance.Position);

	function style_based_on_whether_is_active(active = active_point.Get()) {
		item.TextLabel.BackgroundColor3 = (active === point)
			? new Color3(0.76, 0.76, 0.76)
			: new Color3(0.68, 0.68, 0.68)
	}

	const janitor = new Janitor();
	janitor.Add(point.OnMovement.Connect((cframe) => item.TextLabel.Text = format_vector3(cframe.Position)));
	janitor.Add(active_point.Signal.Connect((active) => style_based_on_whether_is_active(active)));
	item.Destroying.Once(() => janitor.Destroy())
	style_based_on_whether_is_active(active_point.Get())


	item.ReorderButtons.Up.MouseButton1Click.Connect(() => curve.SwapPoints(index, index - 1))
	item.ReorderButtons.Down.MouseButton1Click.Connect(() => curve.SwapPoints(index, index + 1))

	item.RightButtons.Copy.MouseButton1Click.Connect(() => curve.AddPoint(get_character().GetPivot().Position, index))
	item.RightButtons.Delete.MouseButton1Click.Once(() => {
		const { ok, err } = curve.RemovePoint(index)
		if (!ok) warn(err)
	});
});


export const editor_curve_settings = new Instance("ScrollingFrame");
editor_curve_settings.Name = "Curve Settings"
editor_curve_settings.Position = UDim2.fromScale(0.8, 0)
editor_curve_settings.Size = UDim2.fromScale(0.20, 1);
editor_curve_settings.Parent = editor;
new Instance("UIListLayout", editor_curve_settings).SortOrder = Enum.SortOrder.LayoutOrder;

const ButtonLabelledTextInput = Component(() => {
	const frame = new Instance("Frame");
	frame.Size = new UDim2(0, 100, 0, 50);
	frame.Name = "ButtonLabelledTextInput"

	const input = new Instance("TextBox")
	input.Name = "Input"
	input.Size = new UDim2(0, 100, 0, 30);
	input.Parent = frame;

	const button = new Instance("TextButton")
	button.Name = "Button"
	button.Size = new UDim2(0, 100, 0, 20);
	button.Position = new UDim2(0, 0, 0, 30);
	button.Parent = frame;

	return frame as Frame & {
		Input: TextBox,
		Button: TextButton
	}
}, () => {});

const resolution_frame = ButtonLabelledTextInput();
resolution_frame.Parent = editor_curve_settings
resolution_frame.Button.Text = "Set Resolution"
resolution_frame.Button.MouseButton1Click.Connect(() => {
	const res = tonumber(resolution_frame.Input.Text);
	if (res === undefined) return warn("can't convert res to number");
	const curve = selected_curve.Get();
	if (!curve) return warn("no curve selected");
	curve.SetResolution(res);
	curve.Render();
})

const part_transparency = ButtonLabelledTextInput();
part_transparency.Parent = editor_curve_settings
part_transparency.Button.Text = "Part Transparency"
part_transparency.Button.MouseButton1Click.Connect(() => {
	const num = tonumber(part_transparency.Input.Text);
	if (num === undefined) return warn("can't convert res to number");
	const curve = selected_curve.Get()!;
	curve.PathInstanceTemplate.Transparency = num;
	curve.Repool();
	curve.Render();
})

const trace = ButtonLabelledTextInput();
trace.Parent = editor_curve_settings
trace.Button.Text = "Trace (Time)"
trace.Button.MouseButton1Click.Connect(() => {
	const input_seconds = tonumber(trace.Input.Text);
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
	janitor.Add(curve.OnDestroy.Connect(() => janitor.Destroy())) // might run into race condition in heartbeat
	janitor.Add(curve.OnUpdate.Connect(() => positions = curve.GetPointPositions()))
	janitor.Add(RunService.Heartbeat.Connect((delta) => {
		const progress = (elapsed / input_seconds)
		if (progress > 1) {
			janitor.Destroy();
			tracer.Destroy();
			return;
		}
		const position = bezier(positions, progress);
		const velocity = bezier(positions, progress, 1)
		tracer.CFrame = CFrame.lookAlong(position, velocity).mul(curve.OrientationBasis);
		elapsed += delta;
	}));
})


const LabelledCheckbox = Component(() => {
	const input = new Instance("TextButton")
	input.Name = "Checkbox"
	input.Size = new UDim2(0, 100, 0, 30);
	const value = new Instance("BoolValue");
	value.Name = "State"
	value.Parent = input;
	return input as TextButton & { State: BoolValue }
}, (element, description: string, initial: boolean = false) => {
	function update() {
		element.Text = description + ": " + (element.State.Value ? "✅" : "❌")
	}
	element.MouseButton1Click.Connect(() => element.State.Value = !element.State.Value);
	element.State.Value = initial;
	element.State.GetPropertyChangedSignal("Value").Connect(() => update());
	update()
});

const size_toggle = LabelledCheckbox("Fit w/ Size");
size_toggle.Parent = editor_curve_settings;
size_toggle.State.GetPropertyChangedSignal("Value").Connect(() => {
	const curve = selected_curve.Get()!;
	curve!.UseSize = size_toggle.State.Value
	curve.Repool();
	curve.Render();
})

const CyclableOptionsInput = Component(() => {
	const input = new Instance("TextButton")
	input.Name = "CyclableOptionsInput"
	input.Size = new UDim2(0, 100, 0, 30);
	input.RichText = true;
	const value = new Instance("NumberValue");
	value.Name = "Index"
	value.Parent = input;
	return input as TextButton & { Index: NumberValue }
}, (element, description: string, variants: string[], initial_index: number = 0) => {
	element.Index.Value = initial_index;
	function tick() {
		let v = element.Index.Value;
		v += 1;
		v %= variants.size();
		element.Index.Value = v;
	}
	function render() {
		element.Text = description + ": <b>" + variants[element.Index.Value] + "</b>"
	}

	element.Index.GetPropertyChangedSignal("Value").Connect(() => { render() })
	element.MouseButton1Click.Connect(() => tick())
	render();
});


const style_option_variants = [
	BezierCurveDisplay.VisualColorDataSource.Velocity,
	BezierCurveDisplay.VisualColorDataSource.Direction,
	BezierCurveDisplay.VisualColorDataSource.Curvature,
	BezierCurveDisplay.VisualColorDataSource.Random,
	BezierCurveDisplay.VisualColorDataSource.None
]
const style_option = CyclableOptionsInput("Style", style_option_variants)
style_option.Parent = editor_curve_settings;
style_option.Index.GetPropertyChangedSignal("Value").Connect(() => {
	const curve = selected_curve.Get()!;
	curve.SetStyle(style_option_variants[style_option.Index.Value])
	curve.Render();
})


const shape_option_variants = [
	Enum.PartType.Block.Name,
	Enum.PartType.Cylinder.Name,
	Enum.PartType.Ball.Name,
	Enum.PartType.Wedge.Name
]
const shape_option = CyclableOptionsInput("Shape", shape_option_variants);
shape_option.Parent = editor_curve_settings;
shape_option.Index.GetPropertyChangedSignal("Value").Connect(() => {
	selected_curve.Get()!.ApplyPhysicalModification((part) => {
		part.Shape = shape_option_variants[shape_option.Index.Value] as unknown as Enum.PartType
	})
})

const Button = Component(() => {
	const input = new Instance("TextButton")
	input.Name = "Button"
	input.Size = new UDim2(0, 100, 0, 30)
	return input
}, (element, description: string, onclick: () => void) => {
	element.Text = description;
	const connection = element.MouseButton1Click.Connect(() => onclick())
	element.Destroying.Connect(() => connection.Disconnect())
});


export const editor_general_settings = new Instance("ScrollingFrame");
editor_general_settings.Name = "General Settings"
editor_general_settings.Position = editor_curve_settings.Position
editor_general_settings.Size = editor_curve_settings.Size
editor_general_settings.Visible = false;
editor_general_settings.Parent = editor;
new Instance("UIListLayout", editor_general_settings).SortOrder = Enum.SortOrder.LayoutOrder;


const sound_toggle = LabelledCheckbox("Sound Effects");
sound_toggle.Parent = editor_general_settings;
sound_toggle.State.Value = use_sound_effects.Get()
sound_toggle.State.GetPropertyChangedSignal("Value").Connect(() => {
	use_sound_effects.Set(size_toggle.State.Value)
})


function update_editor_curve_settings(curve: BezierCurveDisplay | undefined) {
	editor_curve_settings.Visible = (curve !== undefined);
	editor_general_settings.Visible = (curve === undefined);
	if (curve) {
		resolution_frame.Input.Text = tostring(curve.GetResolution());
		part_transparency.Input.Text = tostring(round(curve.PathInstanceTemplate.Transparency, 6));
		size_toggle.State.Value = curve.UseSize;
		style_option.Index.Value = style_option_variants.indexOf(curve.GetStyle());
		shape_option.Index.Value = shape_option_variants.indexOf(curve.PathInstanceTemplate.Shape.Name as typeof shape_option_variants[number])
		trace.Input.Text = "1"
	}
}
selected_curve.Signal.Connect((curve) => update_editor_curve_settings(curve))
update_editor_curve_settings(selected_curve.Get())
