import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "./SettingsPanel";

afterEach(cleanup);

const defaults = {
  useHash: true,
  useSize: true,
  useName: false,
  useMtime: false,
  useMime: false,
  hashLimitEnabled: true,
  hashMaxMb: 500,
  includeSubfolders: true,
  namePrefix: "",
  skipSameFolderPrompt: false,
};

describe("SettingsPanel", () => {
  it("renders all criterion checkboxes with correct checked state", () => {
    render(<SettingsPanel {...defaults} onChange={vi.fn()} />);

    const hash = screen.getByLabelText("Content hash (SHA-256)") as HTMLInputElement;
    const size = screen.getByLabelText("Size") as HTMLInputElement;
    const name = screen.getByLabelText("File name") as HTMLInputElement;
    const mtime = screen.getByLabelText("Modified time") as HTMLInputElement;
    const mime = screen.getByLabelText("MIME type") as HTMLInputElement;

    expect(hash.checked).toBe(true);
    expect(size.checked).toBe(true);
    expect(name.checked).toBe(false);
    expect(mtime.checked).toBe(false);
    expect(mime.checked).toBe(false);
  });

  it("calls onChange when checkbox toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsPanel {...defaults} onChange={onChange} />);

    await user.click(screen.getByLabelText("File name"));
    expect(onChange).toHaveBeenCalledWith("use_name", true);
  });

  it("shows confidence warning when hash disabled", () => {
    render(<SettingsPanel {...defaults} useHash={false} onChange={vi.fn()} />);
    expect(screen.getByText(/without content hashing/i)).toBeInTheDocument();
  });

  it("hides confidence warning when hash enabled", () => {
    render(<SettingsPanel {...defaults} useHash={true} onChange={vi.fn()} />);
    expect(screen.queryByText(/without content hashing/i)).not.toBeInTheDocument();
  });

  it("detects current preset from checkbox state", () => {
    // hash=true, size=true => "default"
    render(<SettingsPanel {...defaults} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("default");
  });

  it("applies preset from dropdown selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsPanel {...defaults} onChange={onChange} />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "aggressive");

    expect(onChange).toHaveBeenCalledWith("use_hash", true);
    expect(onChange).toHaveBeenCalledWith("use_size", true);
    expect(onChange).toHaveBeenCalledWith("use_name", true);
    expect(onChange).toHaveBeenCalledWith("use_mtime", true);
    expect(onChange).toHaveBeenCalledWith("use_mime", true);
  });
});
