import { useRef } from 'react';

export function UploadControl({
  label,
  accept,
  disabled,
  onFilesSelected,
}: {
  label: string;
  accept: string;
  disabled?: boolean;
  onFilesSelected: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button type="button" className="button-primary" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files);
          }
          e.target.value = '';
        }}
      />
    </>
  );
}
