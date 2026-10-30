import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { errorMiddleware } from "./server/errorMiddleware";

// Server functions use cookie auth, so a cross-site form or fetch must not be able to call them.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  functionMiddleware: [errorMiddleware],
}));
