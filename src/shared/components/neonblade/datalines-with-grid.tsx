import { type FC, useEffect, useRef, useState } from "hono/jsx";

type DatalinesWithGridProps = {
	lineColor?: string;
	shadowColor?: string;
	bgGridColor?: string;
	cellSize?: number;
	maxLines?: number;
	baseSpeed?: number;
	lineLength?: number;
	spawnProbability?: number;
	overlay?: boolean;
};

function hexToRgbA(hex: string, alpha: number): string {
	if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		const c = hex.substring(1).split("");
		const padded = c.length === 3 ? [c[0], c[0], c[1], c[1], c[2], c[2]] : c;
		const num = Number(`0x${padded.join("")}`);
		return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
	}
	if (hex.startsWith("rgb")) {
		return hex
			.replace("rgb", "rgba")
			.replace(")", `, ${alpha})`)
			.replace(",,", ",");
	}
	return hex;
}

const DatalinesCanvas: FC<{
	lineColor?: string;
	shadowColor?: string;
	cellSize?: number;
	maxLines?: number;
	baseSpeed?: number;
	lineLength?: number;
	spawnProbability?: number;
}> = ({
	lineColor = "#00f3ff",
	shadowColor = "#00f3ff",
	cellSize = 50,
	maxLines = 15,
	baseSpeed = 2,
	lineLength = 150,
	spawnProbability = 0.1,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;

		const resizeCanvas = () => {
			canvas.width = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;
		};
		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);

		type DataLine = {
			x: number;
			y: number;
			history: { x: number; y: number }[];
			dx: number;
			dy: number;
			speed: number;
			lineLengthPx: number;
		};

		let lines: DataLine[] = [];

		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			if (Math.random() < spawnProbability && lines.length < maxLines) {
				lines.push({
					x: Math.floor(Math.random() * (canvas.width / cellSize)) * cellSize,
					y: -cellSize,
					history: [],
					dx: 0,
					dy: 1,
					speed: baseSpeed,
					lineLengthPx: Math.floor(
						Math.random() * lineLength * 0.5 + lineLength * 0.75,
					),
				});
			}

			for (const line of lines) {
				line.history.push({ x: line.x, y: line.y });
				const historyLimit = Math.max(
					2,
					Math.ceil(line.lineLengthPx / line.speed),
				);
				if (line.history.length > historyLimit) line.history.shift();

				line.x += line.dx * line.speed;
				line.y += line.dy * line.speed;

				if (line.x % cellSize === 0 && line.y % cellSize === 0) {
					const maxX = Math.floor(canvas.width / cellSize) * cellSize;
					if (line.x <= 0 && line.dx === -1) {
						line.dx = 0;
						line.dy = 1;
					} else if (line.x >= maxX && line.dx === 1) {
						line.dx = 0;
						line.dy = 1;
					} else {
						if (line.dy === 1) {
							if (Math.random() < 0.3) {
								line.dy = 0;
								line.dx = Math.random() < 0.5 ? 1 : -1;
							}
						} else {
							if (Math.random() < 0.6) {
								line.dy = 1;
								line.dx = 0;
							}
						}
					}
				}

				if (line.history.length < 2) continue;

				const h = line.history;
				const tail = h[0];
				const head = h[h.length - 1];
				if (!tail || !head) continue;

				ctx.lineCap = "round";
				ctx.lineJoin = "round";
				ctx.lineWidth = 1.5;

				const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
				grad.addColorStop(0, hexToRgbA(lineColor, 0));
				grad.addColorStop(0.6, hexToRgbA(lineColor, 0.35));
				grad.addColorStop(1, hexToRgbA(lineColor, 0.9));

				const startEl = h[0];
				if (!startEl) continue;
				ctx.beginPath();
				ctx.moveTo(startEl.x, startEl.y);
				for (let i = 1; i < h.length; i++) {
					const p = h[i];
					if (p) ctx.lineTo(p.x, p.y);
				}
				ctx.strokeStyle = grad;
				ctx.shadowBlur = 0;
				ctx.stroke();

				const headCount = Math.max(2, Math.ceil(20 / Math.max(1, line.speed)));
				const headIdx = Math.max(0, h.length - 1 - headCount);
				const startPoint = h[headIdx];
				if (!startPoint) continue;
				ctx.beginPath();
				ctx.moveTo(startPoint.x, startPoint.y);
				for (let i = headIdx + 1; i < h.length; i++) {
					const p = h[i];
					if (p) ctx.lineTo(p.x, p.y);
				}
				ctx.strokeStyle = hexToRgbA(lineColor, 0.95);
				ctx.shadowColor = shadowColor;
				ctx.shadowBlur = 10;
				ctx.stroke();
				ctx.shadowBlur = 0;
			}

			lines = lines.filter((line) => {
				if (line.history.length === 0) return true;
				const first = line.history[0];
				return first ? first.y < canvas.height + cellSize * 2 : true;
			});

			animationFrameId = requestAnimationFrame(draw);
		};

		draw();

		return () => {
			window.removeEventListener("resize", resizeCanvas);
			cancelAnimationFrame(animationFrameId);
		};
	}, [
		lineColor,
		shadowColor,
		cellSize,
		maxLines,
		baseSpeed,
		lineLength,
		spawnProbability,
	]);

	return (
		<canvas
			ref={canvasRef}
			class="absolute inset-0 w-full h-full pointer-events-none z-10"
		/>
	);
};

export const DatalinesWithGrid: FC<DatalinesWithGridProps> = ({
	lineColor = "#00f3ff",
	shadowColor = "#00f3ff",
	cellSize = 50,
	maxLines = 10,
	baseSpeed = 2,
	lineLength = 150,
	spawnProbability = 0.1,
	bgGridColor = "rgba(255,255,255,0.05)",
	overlay = false,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [tiles, setTiles] = useState(0);

	useEffect(() => {
		if (!containerRef.current) return;

		const updateTiles = () => {
			if (containerRef.current) {
				const { clientWidth, clientHeight } = containerRef.current;
				const columns = Math.ceil(clientWidth / cellSize);
				const rows = Math.ceil(clientHeight / cellSize) + 1;
				setTiles(columns * rows);
			}
		};

		updateTiles();
		window.addEventListener("resize", updateTiles);
		return () => window.removeEventListener("resize", updateTiles);
	}, [cellSize]);

	return (
		<div
			ref={containerRef}
			class="absolute inset-0 z-0 overflow-hidden flex flex-wrap"
		>
			<DatalinesCanvas
				lineColor={lineColor}
				shadowColor={shadowColor}
				cellSize={cellSize}
				maxLines={maxLines}
				baseSpeed={baseSpeed}
				lineLength={lineLength}
				spawnProbability={spawnProbability}
			/>
			{Array.from({ length: tiles }).map((_, i) => (
				<div
					key={i}
					class="transition-none box-border"
					style={`width:${cellSize}px;height:${cellSize}px;border:0.5px solid ${bgGridColor}`}
				/>
			))}
			{overlay && (
				<div
					class="absolute inset-0 pointer-events-none z-0"
					style="background:radial-gradient(circle at center, transparent 0%, #050505 100%)"
				/>
			)}
		</div>
	);
};
