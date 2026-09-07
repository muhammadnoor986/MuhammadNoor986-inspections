export function ErrorMessage({ title = 'Something went wrong', message }: { title?: string; message: string }) {
  return (
    <div className="error-message" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
