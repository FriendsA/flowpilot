import fs from "node:fs";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { Store } from "../store";

const HISTORY_DIR = `${os.homedir()}/.flowpilot/history`;

describe("Store", () => {
	let store: Store<{ id: string; name: string }>;

	afterEach(() => {
		try {
			fs.unlinkSync(`${HISTORY_DIR}/test-store.json`);
		} catch {
			/* ok */
		}
	});

	it("getAll returns empty array when file missing", () => {
		store = new Store<{ id: string; name: string }>("test-store.json");
		store.clear();
		expect(store.getAll()).toEqual([]);
	});

	it("add persists entry and getAll retrieves it", () => {
		store = new Store<{ id: string; name: string }>("test-store.json");
		store.clear();
		store.add({ id: "1", name: "test" }, (e) => e.id);
		const result = store.getAll();
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ id: "1", name: "test" });
	});

	it("add deduplicates by key and moves to top", () => {
		store = new Store<{ id: string; name: string }>("test-store.json");
		store.clear();
		store.add({ id: "1", name: "first" }, (e) => e.id);
		store.add({ id: "2", name: "second" }, (e) => e.id);
		store.add({ id: "1", name: "updated" }, (e) => e.id);
		const result = store.getAll();
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ id: "1", name: "updated" });
		expect(result[1]).toEqual({ id: "2", name: "second" });
	});

	it("add trims to maxEntries", () => {
		store = new Store<{ id: string; name: string }>("test-store.json", 3);
		store.clear();
		store.add({ id: "1", name: "a" }, (e) => e.id);
		store.add({ id: "2", name: "b" }, (e) => e.id);
		store.add({ id: "3", name: "c" }, (e) => e.id);
		store.add({ id: "4", name: "d" }, (e) => e.id);
		expect(store.getAll()).toHaveLength(3);
	});

	it("clear deletes the file", () => {
		store = new Store<{ id: string; name: string }>("test-store.json");
		store.add({ id: "1", name: "test" }, (e) => e.id);
		store.clear();
		expect(store.getAll()).toEqual([]);
	});

	it("getAll returns empty on corrupt file", () => {
		store = new Store<{ id: string; name: string }>("test-store.json");
		fs.writeFileSync(`${HISTORY_DIR}/test-store.json`, "not json{{{");
		expect(store.getAll()).toEqual([]);
	});
});
