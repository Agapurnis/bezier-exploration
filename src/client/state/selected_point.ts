import { Point } from "client/point";
import { SubscribableStore } from "shared/store";

export const selected_point = new SubscribableStore<Point | undefined>(undefined)
