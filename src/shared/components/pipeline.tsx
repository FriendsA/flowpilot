// Shared pipeline CSS + helpers + component for release/end/mr Web UI

export const pipelineStepClass = (done: boolean, active: boolean) =>
	done
		? "pipeline-step done"
		: active
			? "pipeline-step active"
			: "pipeline-step";

export const pipelineLineClass = (done: boolean) =>
	done ? "pipeline-line done" : "pipeline-line";

export const pipelineCss = `
/* ── Pipeline ── */
.pipeline {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 28px;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
}
.pipeline-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-family: var(--mono);
  color: var(--text-3);
  font-weight: 400;
  white-space: nowrap;
}
.pipeline-step.active {
  color: var(--neon);
  font-weight: 500;
}
.pipeline-step.done {
  color: var(--cyan);
}
.pipeline-node {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--text-3);
  transition: background 0.3s, box-shadow 0.3s;
}
.pipeline-step.active .pipeline-node {
  background: var(--neon);
  box-shadow: 0 0 8px var(--neon-glow);
  animation: neon-pulse 2s ease infinite;
}
.pipeline-step.done .pipeline-node {
  background: var(--cyan);
  box-shadow: 0 0 4px var(--cyan-glow);
}
.pipeline-line {
  width: 32px;
  height: 1px;
  background: var(--border);
  margin: 0 4px;
  transition: background 0.3s;
}
.pipeline-line.done { background: var(--cyan); }
`;

export type PipelineStep = { label: string; done: boolean; active: boolean };

export function Pipeline({ steps }: { steps: PipelineStep[] }) {
	return (
		<div class="pipeline">
			{steps.map((step, i) => (
				<>
					<div class={pipelineStepClass(step.done, step.active)}>
						<span class="pipeline-node" />
						{step.label}
					</div>
					{i < steps.length - 1 && <div class={pipelineLineClass(step.done)} />}
				</>
			))}
		</div>
	);
}
