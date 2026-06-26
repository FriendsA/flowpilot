// Shared Modal component for release/mr/watch Web UI pages
import type { FC } from "hono/jsx";
import { CornerCutButton } from "./neonblade/corner-cut-button";

type ModalProps = {
	open: boolean;
	onClose: () => void;
	title: string;
	children: unknown;
	variant?: "default" | "wide";
};

export const Modal: FC<ModalProps> = ({
	open,
	onClose,
	title,
	children,
	variant,
}) => {
	if (!open) return null;
	return (
		<div
			class="modal-overlay"
			onClick={(e: Event) => {
				if ((e.target as HTMLElement).classList.contains("modal-overlay"))
					onClose();
			}}
		>
			<div class={`modal-content${variant === "wide" ? " modal-wide" : ""}`}>
				<div class="modal-header">
					<span class="modal-title">{title}</span>
					<CornerCutButton
						color="cyan"
						size="xs"
						variant="ghost"
						corner="all"
						hoverEffect="glow"
						className="modal-close"
						onClick={onClose}
					>
						✕
					</CornerCutButton>
				</div>
				{children}
			</div>
		</div>
	);
};

export const modalCss = `
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  overflow-y: auto;
  padding: 40px 0;
  z-index: 999;
  animation: fade-in 0.15s ease both;
}
.modal-content {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 90%;
  max-width: 540px;
  margin: auto;
  padding: 24px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 12px rgba(0,243,255,0.03);
  animation: slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.modal-wide { max-width: 640px; }
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
}
.modal-close {
  padding: 0 !important;
  width: 28px; height: 28px;
  line-height: 0;
}
.modal-close button {
  padding: 0 !important;
  min-height: 0 !important;
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.modal-close .ccb-clip-all { border-radius: 6px; }
`;
