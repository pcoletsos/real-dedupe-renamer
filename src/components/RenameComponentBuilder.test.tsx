import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RenameComponentBuilder from "./RenameComponentBuilder";
import type { RenameComponent } from "../types";

afterEach(cleanup);

const sampleComponents: RenameComponent[] = [
  { id: "1", kind: "folder_name" },
  { id: "2", kind: "date_created" },
  { id: "3", kind: "sequence", pad_width: 3 },
];

describe("RenameComponentBuilder", () => {
  it("renders chips for all components", () => {
    render(
      <RenameComponentBuilder
        components={sampleComponents}
        separator="_"
        onComponentsChange={vi.fn()}
        onSeparatorChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Folder")).toBeInTheDocument();
    expect(screen.getByText("DateC")).toBeInTheDocument();
    expect(screen.getByText("Seq")).toBeInTheDocument();
  });

  it("shows live preview text", () => {
    const { container } = render(
      <RenameComponentBuilder
        components={sampleComponents}
        separator="_"
        onComponentsChange={vi.fn()}
        onSeparatorChange={vi.fn()}
      />,
    );

    // The preview row has "Preview:" label followed by the preview text
    const previewRow = container.querySelector(".flex.items-start.gap-2") as HTMLElement;
    expect(previewRow).not.toBeNull();
    const previewSpan = within(previewRow).getByText(/_/);
    expect(previewSpan).toBeInTheDocument();
  });

  it("calls onComponentsChange when removing a chip", async () => {
    const user = userEvent.setup();
    const onComponentsChange = vi.fn();
    render(
      <RenameComponentBuilder
        components={sampleComponents}
        separator="_"
        onComponentsChange={onComponentsChange}
        onSeparatorChange={vi.fn()}
      />,
    );

    const removeButtons = screen.getAllByLabelText(/^Remove /);
    await user.click(removeButtons[0]); // Remove first chip (Folder)

    expect(onComponentsChange).toHaveBeenCalledOnce();
    const newComponents = onComponentsChange.mock.calls[0][0] as RenameComponent[];
    expect(newComponents).toHaveLength(2);
    expect(newComponents[0].kind).toBe("date_created");
  });

  it("resets to defaults when Reset clicked", async () => {
    const user = userEvent.setup();
    const onComponentsChange = vi.fn();
    const onSeparatorChange = vi.fn();
    render(
      <RenameComponentBuilder
        components={[{ id: "99", kind: "literal", value: "test" }]}
        separator="-"
        onComponentsChange={onComponentsChange}
        onSeparatorChange={onSeparatorChange}
      />,
    );

    await user.click(screen.getByText("Reset to default"));

    expect(onComponentsChange).toHaveBeenCalledOnce();
    const newComponents = onComponentsChange.mock.calls[0][0] as RenameComponent[];
    expect(newComponents).toHaveLength(4);
    expect(newComponents.map((c) => c.kind)).toEqual([
      "folder_name",
      "date_created",
      "time_created",
      "sequence",
    ]);

    expect(onSeparatorChange).toHaveBeenCalledWith("_");
  });
});
