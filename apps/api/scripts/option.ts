// Reads --name=value from the command line as a whole number within a range; the process
// ends with code 2 on anything else.
export function option(name: string, fallback: number, min: number, max: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  if (raw === undefined || raw === '') return fallback;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!(value >= min && value <= max)) {
    console.error(`--${name} must be a whole number from ${min} to ${max}`);
    process.exit(2);
  }
  return value;
}
