// Port for unexpected errors. Without a DSN nothing leaves the process (ADR-0030).
export interface ErrorReporter {
  report(error: unknown, context: { requestId: string }): Promise<void>;
}

export const noErrorReporter: ErrorReporter = {
  report: async () => {},
};
