import { make } from "shared/util"

const CurveWorker = script.Parent!.WaitForChild("curve-worker") as LocalScript

export = new class CurveWorkerOrchestrator {
	public readonly OnScriptRegister = make("BindableEvent", { Name: "Registered", Parent: script })
	public readonly OnJobComplete = make("BindableEvent", { Name: "JobCompletion", Parent: script })
	private readonly ActorContainer = make("Folder", { Name: "Actors", Parent: script })
	private Actors: Actor[] = [];
	private RegisteredCount = 0;
	private SpawnActor(): Actor {
		const actor = new Instance("Actor");
		CurveWorker.Clone().Parent = actor;
		actor.Parent = this.ActorContainer;
		return actor;
	}
	public GetActors() {
		return this.Actors
	}
	public AdjustQuantity(target_amount: number): Promise<void> {
		if (target_amount > this.RegisteredCount) {
			const waiting = new Promise<void>((resolve) => {
				const watching = this.OnScriptRegister.Event.Connect(() => {
					this.RegisteredCount += 1;
					if (this.RegisteredCount === target_amount) {
						this.Actors = this.ActorContainer.GetChildren() as Actor[]
						watching.Disconnect();
						resolve()
					}
				})
			});

			for (const _ of $range(this.RegisteredCount, target_amount - 1)) {
				this.SpawnActor()
			}
			return waiting;
		} else {
			const actors = this.GetActors()
			for (const index of $range(this.RegisteredCount - 1, target_amount, -1)) {
				actors[index].Destroy()
			}
			this.RegisteredCount = target_amount
			return Promise.resolve()
		}
	}
}
