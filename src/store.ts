import fs from "node:fs";
import { HISTORY_DIR } from "./constants";

export class Store<T> {
	private dir: string;
	private filepath: string;
	private maxEntries: number;

	constructor(filename: string, maxEntries = 20) {
		this.dir = HISTORY_DIR;
		this.filepath = `${this.dir}/${filename}`;
		this.maxEntries = maxEntries;
		this.ensureDir();
	}

	private ensureDir() {
		if (!fs.existsSync(this.dir)) {
			fs.mkdirSync(this.dir, { recursive: true });
		}
	}

	getAll(): T[] {
		try {
			if (!fs.existsSync(this.filepath)) return [];
			const raw = fs.readFileSync(this.filepath, "utf-8");
			return JSON.parse(raw) as T[];
		} catch {
			return [];
		}
	}

	add(entry: T, dedupKey: (e: T) => string): void {
		let entries = this.getAll();
		const key = dedupKey(entry);
		const existingIdx = entries.findIndex((e) => dedupKey(e) === key);
		if (existingIdx >= 0) {
			entries.splice(existingIdx, 1);
		}
		entries.unshift(entry);
		if (entries.length > this.maxEntries) {
			entries = entries.slice(0, this.maxEntries);
		}
		this.persist(entries);
	}

	clear(): void {
		try {
			fs.unlinkSync(this.filepath);
		} catch {
			// file already gone
		}
	}

	remove(id: string): void {
		const entries = this.getAll().filter((e) => {
			const entry = e as { id?: string };
			return entry.id !== id;
		});
		this.persist(entries);
	}

	private persist(entries: T[]): void {
		this.ensureDir();
		fs.writeFileSync(this.filepath, JSON.stringify(entries, null, 2));
	}
}
