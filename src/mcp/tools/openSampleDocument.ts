// open_sample_document — put a document in the viewer.
//
// The samples are fiction written for this project. They exist so a judge, or
// anyone else, can reach the interesting part of the workflow in one call
// without having to find a confidential document of their own to experiment on.

import { contract } from "./shared";
import { getSample } from "../../core/samples";
import { openDocument } from "../../state/store";

export function openSampleDocument(): WebMCPTool {
  return {
    ...contract("open_sample_document"),
    execute: async (input) => {
      const id = String(input.document ?? "");
      const sample = getSample(id);
      if (!sample) {
        throw new Error(
          `"${id}" is not one of the samples. Pass document as leaked_memo, medical_record or vendor_contract.`
        );
      }

      const { blurb, ...rest } = sample;
      openDocument({ ...rest, source: "sample" }, "agent");

      return {
        document: sample.id,
        title: sample.title,
        kind: sample.kind,
        pages: sample.pages.length,
        about: blurb,
        note: "Nothing has been scanned yet. Call describe_document or scan_for_sensitive_data next."
      };
    }
  };
}
