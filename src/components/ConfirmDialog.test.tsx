import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Title"
        message="Message"
        buttons={[]}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders title and message when open", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Files"
        message="Are you sure?"
        buttons={[]}
      />,
    );
    expect(screen.getByText("Delete Files")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("calls button onClick handlers", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        buttons={[
          { label: "Cancel", onClick: onCancel },
          { label: "OK", onClick: onConfirm, variant: "danger" },
        ]}
      />,
    );

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();

    await user.click(screen.getByText("OK"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("applies danger variant CSS class", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Confirm"
        message="Proceed?"
        buttons={[{ label: "Danger Btn", onClick: vi.fn(), variant: "danger" }]}
      />,
    );
    const btn = screen.getByText("Danger Btn");
    expect(btn.className).toContain("bg-red-100");
  });
});
