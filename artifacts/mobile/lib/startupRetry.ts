export interface StartupRetryAccount {
  userId: string | null;
  name: string;
  email: string;
}

export function retryStartupInitialization(input: {
  account: StartupRetryAccount;
  clearTimedOut: () => void;
  incrementRetryAttempt: () => void;
  initialize: (name: string, email: string, userId: string) => void;
}): void {
  input.clearTimedOut();
  input.incrementRetryAttempt();
  if (input.account.userId) {
    input.initialize(input.account.name, input.account.email, input.account.userId);
  }
}