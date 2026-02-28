import { describe, expect, it } from "vitest";
import type { AutoRenameCandidateDto, RenameComponent } from "../types";
import { buildAllPreviews, buildFilePreview, buildName } from "./renamePreview";

function makeCandidate(
  path: string,
  name: string,
  folder: string,
  extension: string,
): AutoRenameCandidateDto {
  return {
    path,
    name,
    folder,
    extension,
    size: 100,
    mtime: 1700000000,
    mtime_formatted: "2023-11-14 22:13:20",
    created: 1700000000,
  };
}

describe("renamePreview parity", () => {
  it("omits Sequence when seq is null", () => {
    const components: RenameComponent[] = [
      { id: "1", kind: "folder_name" },
      { id: "2", kind: "sequence", pad_width: 3 },
    ];

    const result = buildName(
      components,
      "_",
      "Photos",
      "img001",
      ".jpg",
      null,
      null,
      null,
    );

    expect(result).toBe("Photos.jpg");
  });

  it("pads Sequence when seq is provided", () => {
    const components: RenameComponent[] = [
      { id: "1", kind: "folder_name" },
      { id: "2", kind: "sequence", pad_width: 3 },
    ];

    const result = buildName(
      components,
      "_",
      "Photos",
      "img001",
      ".jpg",
      null,
      null,
      7,
    );

    expect(result).toBe("Photos_007.jpg");
  });

  it("builds literal + original stem with custom separator", () => {
    const components: RenameComponent[] = [
      { id: "1", kind: "literal", value: "backup" },
      { id: "2", kind: "original_stem" },
    ];

    const result = buildName(
      components,
      "-",
      "folder",
      "report",
      ".pdf",
      null,
      null,
      null,
    );

    expect(result).toBe("backup-report.pdf");
  });

  it("derives folder name and extension in per-file preview", () => {
    const components: RenameComponent[] = [
      { id: "1", kind: "folder_name" },
      { id: "2", kind: "original_stem" },
    ];
    const candidate = makeCandidate(
      "C:\\\\data\\\\Invoices\\\\old_name.TXT",
      "old_name.TXT",
      "C:\\\\data\\\\Invoices",
      "TXT",
    );

    const result = buildFilePreview(components, "_", candidate, null);
    expect(result).toBe("Invoices_old_name.TXT");
  });

  it("assigns sequential names for colliding base names", () => {
    const components: RenameComponent[] = [
      { id: "1", kind: "folder_name" },
      { id: "2", kind: "sequence", pad_width: 3 },
    ];
    const candidates = [
      makeCandidate(
        "C:\\\\photos\\\\a.jpg",
        "a.jpg",
        "C:\\\\photos",
        ".jpg",
      ),
      makeCandidate(
        "C:\\\\photos\\\\b.jpg",
        "b.jpg",
        "C:\\\\photos",
        ".jpg",
      ),
    ];

    const previews = buildAllPreviews(candidates, components, "_");
    expect(previews.get(candidates[0].path)).toBe("photos_001.jpg");
    expect(previews.get(candidates[1].path)).toBe("photos_002.jpg");
  });

  it("keeps base name on collision when schema has no Sequence", () => {
    const components: RenameComponent[] = [{ id: "1", kind: "folder_name" }];
    const candidates = [
      makeCandidate(
        "C:\\\\photos\\\\a.jpg",
        "a.jpg",
        "C:\\\\photos",
        ".jpg",
      ),
      makeCandidate(
        "C:\\\\photos\\\\b.jpg",
        "b.jpg",
        "C:\\\\photos",
        ".jpg",
      ),
    ];

    const previews = buildAllPreviews(candidates, components, "_");
    expect(previews.get(candidates[0].path)).toBe("photos.jpg");
    expect(previews.get(candidates[1].path)).toBe("photos.jpg");
  });
});
