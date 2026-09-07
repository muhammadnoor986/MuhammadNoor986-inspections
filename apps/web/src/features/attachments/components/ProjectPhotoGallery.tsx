import { useState } from 'react';
import { AttachmentSection } from './AttachmentSection';
import { PHOTO_CATEGORIES, type PhotoCategory } from '../types/attachment';

const TAB_LABEL: Record<PhotoCategory, string> = {
  before: 'Before',
  progress: 'Progress',
  completion: 'Completion',
};

/** Project photo gallery, grouped into Before / Progress / Completion tabs. */
export function ProjectPhotoGallery({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<PhotoCategory>('before');

  return (
    <section className="photo-gallery">
      <h2>Photos</h2>
      <div className="quick-filters" role="tablist" aria-label="Photo category">
        {PHOTO_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={tab === category}
            className={tab === category ? 'active' : ''}
            onClick={() => setTab(category)}
          >
            {TAB_LABEL[category]}
          </button>
        ))}
      </div>

      <AttachmentSection
        key={tab}
        parentKind="project"
        parentId={projectId}
        kind="photo"
        category={tab}
        title={TAB_LABEL[tab]}
        emptyMessage={`No ${TAB_LABEL[tab].toLowerCase()} photos yet.`}
      />
    </section>
  );
}
