import { describe, it, expect } from "vitest";
import { parseCommand } from "./commands";

describe("parseCommand", () => {
  it("/start com token", () => {
    expect(parseCommand("/start abc123")).toEqual({ cmd: "start", arg: "abc123" });
  });
  it("/start sem token", () => {
    expect(parseCommand("/start")).toEqual({ cmd: "start", arg: "" });
  });
  it("remove a menção ao bot", () => {
    expect(parseCommand("/start@Overtraderia_bot tok")).toEqual({ cmd: "start", arg: "tok" });
  });
  it("/stop", () => {
    expect(parseCommand("/stop")).toEqual({ cmd: "stop", arg: "" });
  });
  it("texto que não é comando → null", () => {
    expect(parseCommand("olá")).toBeNull();
    expect(parseCommand("")).toBeNull();
    expect(parseCommand(undefined)).toBeNull();
  });
});
