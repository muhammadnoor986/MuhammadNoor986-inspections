import { AttachmentSection } from './AttachmentSection';

/** Inspection attachments: photos and reports/documents. */
export function InspectionAttachments({ inspectionId }: { inspectionId: string }) {
  return (
    <section className="photo-gallery">
      <h2>Attachments</h2>
      <AttachmentSection
        parentKind="inspection"
        parentId={inspectionId}
        kind="photo"
        title="Photos"
        emptyMessage="No photos uploaded for this inspection yet."
      />
      <AttachmentSection
        parentKind="inspection"
        parentId={inspectionId}
        kind="document"
        title="Reports / Documents"
        emptyMessage="No reports or documents uploaded for this inspection yet."
      />
    </section>
  );
}
