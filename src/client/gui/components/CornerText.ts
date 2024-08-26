import { make } from "shared/util";
import { screen } from "../util";
import { AbstractComponent } from "./AbstractComponent";

export const enum Corner {
	TopLeft,
	TopRight,
	BottomRight,
	BottomLeft
}

export namespace CornerQuery {
	export function is_left(corner: Corner) {
		return (
			corner === Corner.   TopLeft ||
			corner === Corner.BottomLeft
		)
	}
	export function is_right(corner: Corner) {
		return !is_left(corner)
	}
	export function is_top(corner: Corner) {
		return (
			corner === Corner.TopLeft ||
			corner === Corner.TopRight
		)
	}
	export function is_bottom(corner: Corner) {
		return !is_top(corner)
	}
}

export class CornerText implements AbstractComponent {
	private static readonly InstanceTemplate = make("TextLabel", {
		Size: UDim2.fromOffset(200, 30),
		TextSize: 9,
		TextStrokeColor3: new Color3(1, 1, 1),
		TextStrokeTransparency: 0.85,
		BackgroundTransparency: 1,
	});

	protected static ApplyCornerPositionStyling(instance: TextLabel, top: boolean, left: boolean, padding: UDim2) {
		/* eslint-disable no-mixed-spaces-and-tabs */
		instance.Position = new UDim2(
			left ? 0 + padding.X.Scale : 1 - padding.X.Scale, (left ? padding.X.Offset : -(instance.Size.X.Offset + padding.X.Offset)),
			 top ? 0 + padding.Y.Scale : 1 - padding.Y.Scale, ( top ? padding.Y.Offset : -(instance.Size.Y.Offset + padding.Y.Offset))
		);
		/* eslint-enable no-mixed-spaces-and-tabs */
	}

	protected static ApplyCornerTextAlignmentStyling(instance: TextLabel, top: boolean, left: boolean) {
		instance.TextXAlignment = left ? Enum.TextXAlignment.Left : Enum.TextXAlignment.Right;
		instance.TextYAlignment =  top ? Enum.TextYAlignment.Top  : Enum.TextYAlignment.Bottom;
	}

	protected static ApplyCornerStyling(instance: TextLabel, corner: Corner, padding: UDim2) {
		const  top = CornerQuery.is_top (corner);
		const left = CornerQuery.is_left(corner)
		CornerText.ApplyCornerTextAlignmentStyling(instance, top, left);
		CornerText.ApplyCornerPositionStyling     (instance, top, left, padding);
	}

	public readonly Instance: typeof CornerText.InstanceTemplate;

	public Padding: UDim2;
	public GetPadding(): UDim2 { return this.Padding }
	public SetPadding(padding: UDim2) {
		this.Padding = padding;
		CornerText.ApplyCornerPositionStyling(this.Instance,
			CornerQuery.is_top(this.Corner),
			CornerQuery.is_top(this.Corner),
			padding
		)
	}

	private Corner: Corner;
	public GetCorner(): Corner { return this.Corner }
	public SetCorner(corner: Corner) {
		this.Corner = corner;
		CornerText.ApplyCornerStyling(this.Instance, corner, this.Padding)
	}

	public GetText(): string { return this.Instance.Text }
	public SetText(text: string) { this.Instance.Text = text }

	constructor(
		public readonly Name: string,
		corner: Corner,
		padding: UDim2,
		text: string,
		parent: GuiBase = screen
	) {
		this.Corner = corner;
		this.Padding = padding;
		this.Instance = CornerText.InstanceTemplate.Clone();
		CornerText.ApplyCornerStyling(this.Instance, corner, padding)
		this.SetText(text)
		this.Instance.Parent = parent;
	}

	public Destroy(): void {
		this.Instance.Destroy();
	}
}

export namespace CornerText {
	export type Instance = CornerText["Instance"]
}

