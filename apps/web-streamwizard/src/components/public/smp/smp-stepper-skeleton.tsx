/* Holds the stepper's place while the server checks a signed-in visitor's steps. */
export function SmpStepperSkeleton() {
  return (
    <div role="status" className="mx-auto flex max-w-3xl flex-col gap-4">
      <span className="sr-only">Checking your steps</span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} aria-hidden="true" className="pixel-panel h-24 opacity-60" />
      ))}
    </div>
  );
}
